import { findDuplicateFrom, parseConfig, validateConfig } from '../../../module/spellingEditor/validator';

describe('findDuplicateFrom', () => {
	it('returns null when every from is unique', () => {
		expect(findDuplicateFrom([
			{ from: 'data2', to: 'dota2' },
			{ from: '塞尔达', to: '塞尔达传说：旷野之息' }
		])).toBeNull();
	});

	it('returns the first duplicated from', () => {
		expect(findDuplicateFrom([
			{ from: 'data2', to: 'dota2' },
			{ from: 'data2', to: 'DOTA2' }
		])).toBe('data2');
	});

	it('returns null for an empty list', () => {
		expect(findDuplicateFrom([])).toBeNull();
	});
});

describe('parseConfig', () => {
	test('parses a valid V2 config', () => {
		const config = {
			version: '2.0',
			global: { rules: [{ from: 'data2', to: 'dota2' }] },
			uidRules: { '15810': { rules: [{ from: '塞尔达', to: '塞尔达传说：王国之泪' }] } }
		};

		const result = parseConfig(config);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.global.rules).toHaveLength(1);
			expect(result.data.uidRules['15810'].rules).toHaveLength(1);
		}
	});

	test('rejects V1 config format', () => {
		const result = parseConfig({ data2: 'dota2' });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.message).toContain('version');
		}
	});

	test('reports empty from as 不能为空', () => {
		const result = parseConfig({
			version: '2.0',
			global: { rules: [{ from: '', to: 'dota2' }] },
			uidRules: {}
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.message).toContain('global.rules.0.from 不能为空');
		}
	});

	test('reports empty to as 不能为空', () => {
		const result = parseConfig({
			version: '2.0',
			global: { rules: [{ from: 'data2', to: '' }] },
			uidRules: {}
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.message).toContain('to 不能为空');
		}
	});

	test('accepts a config that already contains duplicate from (older files must still load)', () => {
		const result = parseConfig({
			version: '2.0',
			global: { rules: [{ from: 'a', to: 'A' }, { from: 'a', to: 'B' }] },
			uidRules: {}
		});

		expect(result.success).toBe(true);
	});
});

describe('validateConfig', () => {
	test('accepts a valid config', () => {
		const result = validateConfig({
			version: '2.0',
			global: { rules: [{ from: 'data2', to: 'dota2' }] },
			uidRules: {}
		});

		expect(result.success).toBe(true);
	});

	test('rejects duplicate from inside global rules', () => {
		const result = validateConfig({
			version: '2.0',
			global: { rules: [{ from: 'data2', to: 'dota2' }, { from: 'data2', to: 'DOTA2' }] },
			uidRules: {}
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('DUPLICATE_FROM');
			expect(result.message).toContain('data2');
		}
	});

	test('rejects duplicate from inside a uid rules group', () => {
		const result = validateConfig({
			version: '2.0',
			global: { rules: [] },
			uidRules: {
				'15810': { rules: [{ from: '塞尔达', to: 'A' }, { from: '塞尔达', to: 'B' }] }
			}
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('DUPLICATE_FROM');
			expect(result.message).toContain('15810');
		}
	});

	test('allows the same from in global and uidRules (chained correction)', () => {
		const result = validateConfig({
			version: '2.0',
			global: { rules: [{ from: '塞尔达', to: '塞尔达传说：旷野之息' }] },
			uidRules: {
				'15810': { rules: [{ from: '塞尔达', to: '塞尔达传说：王国之泪' }] }
			}
		});

		expect(result.success).toBe(true);
	});

	test('reports VALIDATION_ERROR for structurally invalid input', () => {
		const result = validateConfig({ version: '2.0', global: { rules: 'nope' }, uidRules: {} });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('VALIDATION_ERROR');
		}
	});
});
