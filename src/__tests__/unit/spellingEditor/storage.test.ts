import mockFs from 'mock-fs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import {
	getConfig,
	promoteRuleToGlobal,
	saveFullConfig,
	saveGlobalRules,
	saveUidRules,
	SpellingEditorError,
	upsertUidRules
} from '../../../module/spellingEditor/storage';
import { GlobalRuleConflictError } from '../../../module/spellingEditor/editorCommon';
import type { SpellingCorrectionConfig } from '../../../interface/ISpellingCorrection';

const configPath = join(cwd(), 'data', 'SpellingCorrections.json');
const backupPath = `${configPath}.bak`;

function baseConfig(): SpellingCorrectionConfig {
	return {
		version: '2.0',
		global: { rules: [{ from: 'data2', to: 'dota2' }] },
		uidRules: {
			'15810': { rules: [{ from: '塞尔达', to: '塞尔达传说：王国之泪' }] }
		}
	};
}

/** 按当前配置文件内容建立 mock 文件系统 */
function mountFs(config: SpellingCorrectionConfig | null = baseConfig()): void {
	mockFs({
		data: config === null
			? {}
			: { 'SpellingCorrections.json': JSON.stringify(config, null, '\t') }
	});
}

function readWritten(): SpellingCorrectionConfig {
	return JSON.parse(readFileSync(configPath, 'utf-8'));
}

describe('spellingEditor storage', () => {
	afterEach(() => {
		mockFs.restore();
	});

	describe('getConfig', () => {
		it('returns the parsed configuration', () => {
			mountFs();
			expect(getConfig()).toEqual(baseConfig());
		});

		it('throws INTERNAL_ERROR when the config file is missing', () => {
			mountFs(null);

			expect(() => getConfig()).toThrow(SpellingEditorError);
			try {
				getConfig();
			} catch (error) {
				expect((error as SpellingEditorError).type).toBe('INTERNAL_ERROR');
			}
		});

		it('throws INTERNAL_ERROR when the file is not valid JSON', () => {
			mockFs({ data: { 'SpellingCorrections.json': '{ not json' } });

			try {
				getConfig();
				throw new Error('should have thrown');
			} catch (error) {
				expect((error as SpellingEditorError).type).toBe('INTERNAL_ERROR');
			}
		});

		it('throws INTERNAL_ERROR when the file is not V2', () => {
			mockFs({ data: { 'SpellingCorrections.json': JSON.stringify({ data2: 'dota2' }) } });

			try {
				getConfig();
				throw new Error('should have thrown');
			} catch (error) {
				expect((error as SpellingEditorError).type).toBe('INTERNAL_ERROR');
			}
		});
	});

	describe('saveGlobalRules', () => {
		it('replaces global rules and leaves uidRules untouched', async () => {
			mountFs();

			await saveGlobalRules([{ from: 'gt7 dlc', to: 'gt7' }]);

			const written = readWritten();
			expect(written.global.rules).toEqual([{ from: 'gt7 dlc', to: 'gt7' }]);
			expect(written.uidRules).toEqual(baseConfig().uidRules);
			expect(written.version).toBe('2.0');
		});

		it('backs up the previous content to .bak before writing', async () => {
			mountFs();
			const before = readFileSync(configPath, 'utf-8');

			await saveGlobalRules([{ from: 'a', to: 'A' }]);

			expect(existsSync(backupPath)).toBe(true);
			expect(readFileSync(backupPath, 'utf-8')).toBe(before);
		});

		it('rejects duplicate from and keeps the file unchanged', async () => {
			mountFs();
			const before = readFileSync(configPath, 'utf-8');

			await expect(saveGlobalRules([
				{ from: 'data2', to: 'dota2' },
				{ from: 'data2', to: 'DOTA2' }
			])).rejects.toThrow(/重复/);

			expect(readFileSync(configPath, 'utf-8')).toBe(before);
			expect(existsSync(backupPath)).toBe(false);
		});

		it('rejects an empty from', async () => {
			mountFs();

			try {
				await saveGlobalRules([{ from: '', to: 'dota2' }]);
				throw new Error('should have thrown');
			} catch (error) {
				expect((error as SpellingEditorError).type).toBe('VALIDATION_ERROR');
			}
		});

		it('rejects an empty to', async () => {
			mountFs();

			try {
				await saveGlobalRules([{ from: 'data2', to: '' }]);
				throw new Error('should have thrown');
			} catch (error) {
				expect((error as SpellingEditorError).type).toBe('VALIDATION_ERROR');
			}
		});

		it('strips unknown fields from written rules', async () => {
			mountFs();

			await saveGlobalRules([
				{ from: 'data2', to: 'dota2', extra: 'nope' } as never
			]);

			expect(readWritten().global.rules).toEqual([{ from: 'data2', to: 'dota2' }]);
		});
	});

	describe('saveUidRules', () => {
		it('replaces only the target uid rules', async () => {
			mountFs();

			await saveUidRules('15810', [{ from: '黑神话', to: '黑神话：悟空' }]);

			const written = readWritten();
			expect(written.uidRules['15810'].rules).toEqual([{ from: '黑神话', to: '黑神话：悟空' }]);
			expect(written.global.rules).toEqual(baseConfig().global.rules);
		});

		it('rejects an unknown uid with UID_NOT_FOUND', async () => {
			mountFs();

			try {
				await saveUidRules('99999', []);
				throw new Error('should have thrown');
			} catch (error) {
				expect((error as SpellingEditorError).type).toBe('UID_NOT_FOUND');
			}
		});

		it('allows the same from as global rules', async () => {
			mountFs();

			await saveUidRules('15810', [{ from: 'data2', to: 'DOTA2' }]);

			expect(readWritten().uidRules['15810'].rules).toEqual([{ from: 'data2', to: 'DOTA2' }]);
		});
	});

	describe('upsertUidRules', () => {
		it('creates the uid group when it does not exist yet', async () => {
			mountFs();

			await upsertUidRules('690608693', [{ from: '杂谈', to: '杂谈闲聊' }]);

			expect(readWritten().uidRules['690608693'].rules).toEqual([{ from: '杂谈', to: '杂谈闲聊' }]);
			expect(readWritten().uidRules['15810']).toEqual(baseConfig().uidRules['15810']);
		});

		it('replaces the rules of an existing uid group', async () => {
			mountFs();

			await upsertUidRules('15810', [{ from: '黑神话', to: '黑神话：悟空' }]);

			expect(readWritten().uidRules['15810'].rules).toEqual([{ from: '黑神话', to: '黑神话：悟空' }]);
		});

		it('keeps orphan rules that the caller sends back verbatim', async () => {
			mountFs();

			// 整页提交的语义：调用方负责把完整 rules 数组交回来
			await upsertUidRules('15810', [
				{ from: '数据里没出现过的孤儿', to: 'x' },
				{ from: '黑神话', to: '黑神话：悟空' }
			]);

			expect(readWritten().uidRules['15810'].rules).toHaveLength(2);
		});

		it('rejects duplicate from within the array and keeps the file unchanged', async () => {
			mountFs();
			const before = readFileSync(configPath, 'utf-8');

			try {
				await upsertUidRules('15810', [
					{ from: 'a', to: 'A' },
					{ from: 'a', to: 'B' }
				]);
				throw new Error('should have thrown');
			} catch (error) {
				expect((error as SpellingEditorError).type).toBe('DUPLICATE_FROM');
			}

			expect(readFileSync(configPath, 'utf-8')).toBe(before);
			expect(existsSync(backupPath)).toBe(false);
		});

		it('backs up the previous content before writing', async () => {
			mountFs();
			const before = readFileSync(configPath, 'utf-8');

			await upsertUidRules('690608693', [{ from: 'a', to: 'A' }]);

			expect(readFileSync(backupPath, 'utf-8')).toBe(before);
		});
	});

	describe('promoteRuleToGlobal', () => {
		it('moves the rule from uid to global', async () => {
			mountFs();

			await promoteRuleToGlobal('15810', '塞尔达', '塞尔达传说：王国之泪');

			const written = readWritten();
			expect(written.global.rules).toEqual([
				{ from: 'data2', to: 'dota2' },
				{ from: '塞尔达', to: '塞尔达传说：王国之泪' }
			]);
			expect(written.uidRules['15810'].rules).toEqual([]);
		});

		it('silently drops the uid rule when global already maps to the same to', async () => {
			mountFs({
				version: '2.0',
				global: { rules: [{ from: '塞尔达', to: '王国之泪' }] },
				uidRules: { '15810': { rules: [{ from: '塞尔达', to: '王国之泪' }] } }
			});

			await promoteRuleToGlobal('15810', '塞尔达', '王国之泪');

			const written = readWritten();
			expect(written.global.rules).toEqual([{ from: '塞尔达', to: '王国之泪' }]);
			expect(written.uidRules['15810'].rules).toEqual([]);
		});

		it('throws GlobalRuleConflictError with existingTo when to differs', async () => {
			mountFs({
				version: '2.0',
				global: { rules: [{ from: '塞尔达', to: '旷野之息' }] },
				uidRules: { '15810': { rules: [{ from: '塞尔达', to: '王国之泪' }] } }
			});
			const before = readFileSync(configPath, 'utf-8');

			try {
				await promoteRuleToGlobal('15810', '塞尔达', '王国之泪');
				throw new Error('should have thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(GlobalRuleConflictError);
				expect((error as GlobalRuleConflictError).type).toBe('GLOBAL_RULE_CONFLICT');
				// 前端要靠它拼出「全局已存在 塞尔达 → 旷野之息，是否覆盖」的确认文案
				expect((error as GlobalRuleConflictError).existingTo).toBe('旷野之息');
			}

			// 冲突时 uid 规则不能被删掉
			expect(readFileSync(configPath, 'utf-8')).toBe(before);
			expect(existsSync(backupPath)).toBe(false);
		});

		it('overwrites the conflicting global rule when overwrite is true', async () => {
			mountFs({
				version: '2.0',
				global: { rules: [{ from: '塞尔达', to: '旷野之息' }] },
				uidRules: { '15810': { rules: [{ from: '塞尔达', to: '王国之泪' }] } }
			});

			await promoteRuleToGlobal('15810', '塞尔达', '王国之泪', true);

			const written = readWritten();
			expect(written.global.rules).toEqual([{ from: '塞尔达', to: '王国之泪' }]);
			expect(written.uidRules['15810'].rules).toEqual([]);
		});

		it('rejects an unknown uid with VALIDATION_ERROR', async () => {
			mountFs();

			try {
				await promoteRuleToGlobal('99999', '塞尔达', '王国之泪');
				throw new Error('should have thrown');
			} catch (error) {
				expect((error as SpellingEditorError).type).toBe('VALIDATION_ERROR');
			}
		});

		it('rejects a rule that is not in the uid rules', async () => {
			mountFs();
			const before = readFileSync(configPath, 'utf-8');

			try {
				await promoteRuleToGlobal('15810', '不存在的规则', 'x');
				throw new Error('should have thrown');
			} catch (error) {
				expect((error as SpellingEditorError).type).toBe('VALIDATION_ERROR');
			}

			expect(readFileSync(configPath, 'utf-8')).toBe(before);
		});

		it('rejects a to that differs from the stored rule', async () => {
			mountFs();

			// 请求里的 to 必须与 uid 规则完全一致，避免拿着过期数据改写全局
			try {
				await promoteRuleToGlobal('15810', '塞尔达', '另一个名字');
				throw new Error('should have thrown');
			} catch (error) {
				expect((error as SpellingEditorError).type).toBe('VALIDATION_ERROR');
			}
		});
	});

	describe('saveFullConfig', () => {
		it('writes the whole configuration', async () => {
			mountFs();

			const next: SpellingCorrectionConfig = {
				version: '2.0',
				global: { rules: [] },
				uidRules: { '245335': { rules: [{ from: 'a', to: 'A' }] } }
			};

			await saveFullConfig(next);

			expect(readWritten()).toEqual(next);
		});

		it('rejects a config without uidRules', async () => {
			mountFs();

			await expect(saveFullConfig({
				version: '2.0',
				global: { rules: [] }
			} as unknown as SpellingCorrectionConfig)).rejects.toThrow(SpellingEditorError);
		});
	});

	describe('lock conflict', () => {
		it('returns LOCKED when another process holds the lock', async () => {
			mockFs({
				data: {
					'SpellingCorrections.json': JSON.stringify(baseConfig(), null, '\t'),
					'SpellingCorrections.json.lock': {}
				}
			});

			try {
				await saveGlobalRules([{ from: 'a', to: 'A' }]);
				throw new Error('should have thrown');
			} catch (error) {
				expect((error as SpellingEditorError).type).toBe('LOCKED');
			}
		});
	});
});
