import { migrateSpellingCorrections } from '../../../scripts/migrate-spelling.ts';
import { DataPathManager } from '../../../utils/DataPathManager.ts';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import mockFs from 'mock-fs';

describe('migrateSpellingCorrections', () => {
	const configPath = join(cwd(), 'data', 'SpellingCorrections.json');

	afterEach(() => {
		mockFs.restore();
	});

	test('creates default config when file does not exist', async () => {
		mockFs({
			'node_modules': mockFs.load('node_modules'),
			'data': {}
		});

		const consoleSpy = jest.spyOn(console, 'log');
		await migrateSpellingCorrections();

		expect(existsSync(configPath)).toBe(true);
		const writtenContent = JSON.parse(readFileSync(configPath, 'utf-8'));
		expect(writtenContent.version).toBe('2.0');
		expect(writtenContent.global.rules).toEqual([]);
		expect(writtenContent.uidRules).toEqual({});
		expect(consoleSpy).toHaveBeenCalledWith('No existing config found. Creating default V2 config...');
		consoleSpy.mockRestore();
	});

	test('skips migration when already V2 format', async () => {
		const v2Config = {
			version: '2.0',
			global: { rules: [{ from: 'test', to: 'Test' }] },
			uidRules: {}
		};
		mockFs({
			'node_modules': mockFs.load('node_modules'),
			'data': {
				'SpellingCorrections.json': JSON.stringify(v2Config)
			}
		});

		const consoleSpy = jest.spyOn(console, 'log');
		await migrateSpellingCorrections();

		expect(consoleSpy).toHaveBeenCalledWith('Config is already in V2 format. No migration needed.');
		consoleSpy.mockRestore();
	});

	test('migrates V1 format to V2', async () => {
		const v1Config = {
			'data2': 'dota2',
			'塞尔达': '塞尔达传说：旷野之息'
		};
		mockFs({
			'node_modules': mockFs.load('node_modules'),
			'data': {
				'SpellingCorrections.json': JSON.stringify(v1Config)
			}
		});

		const consoleSpy = jest.spyOn(console, 'log');
		await migrateSpellingCorrections();

		// 检查备份文件是否创建
		const backupPath = `${configPath}.v1.bak`;
		expect(existsSync(backupPath)).toBe(true);
		expect(JSON.parse(readFileSync(backupPath, 'utf-8'))).toEqual(v1Config);

		// 检查新格式
		const writtenContent = JSON.parse(readFileSync(configPath, 'utf-8'));
		expect(writtenContent.version).toBe('2.0');
		expect(writtenContent.global.rules).toHaveLength(2);
		expect(writtenContent.global.rules).toContainEqual({ from: 'data2', to: 'dota2' });
		expect(writtenContent.global.rules).toContainEqual({ from: '塞尔达', to: '塞尔达传说：旷野之息' });
		expect(writtenContent.uidRules).toEqual({});

		expect(consoleSpy).toHaveBeenCalledWith('✓ Backed up old config to:', backupPath);
		expect(consoleSpy).toHaveBeenCalledWith('✓ Migrated to V2 format at:', configPath);
		consoleSpy.mockRestore();
	});

	test('handles empty V1 config', async () => {
		mockFs({
			'node_modules': mockFs.load('node_modules'),
			'data': {
				'SpellingCorrections.json': JSON.stringify({})
			}
		});

		const consoleSpy = jest.spyOn(console, 'log');
		await migrateSpellingCorrections();

		const writtenContent = JSON.parse(readFileSync(configPath, 'utf-8'));
		expect(writtenContent.version).toBe('2.0');
		expect(writtenContent.global.rules).toHaveLength(0);
		expect(consoleSpy).toHaveBeenCalledWith('  - Converted 0 global rules');
		consoleSpy.mockRestore();
	});

	test('exits on invalid config format', async () => {
		mockFs({
			'node_modules': mockFs.load('node_modules'),
			'data': {
				'SpellingCorrections.json': JSON.stringify([]) // 数组是无效的
			}
		});

		const consoleSpy = jest.spyOn(console, 'error');
		const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
			throw new Error(`Process exit with code ${code}`);
		});

		await expect(migrateSpellingCorrections()).rejects.toThrow('Process exit with code 1');
		expect(consoleSpy).toHaveBeenCalledWith('✗ Invalid config format. Expected object.');

		consoleSpy.mockRestore();
		exitSpy.mockRestore();
	});
});
