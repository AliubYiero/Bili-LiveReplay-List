import { parseAidRules, validateAidRules } from '../../../module/spellingEditor/recordsValidator';

describe('recordsValidator', () => {
	describe('parseAidRules', () => {
		it('accepts an object whose values are string arrays', () => {
			const result = parseAidRules({ '123456': ['dota2', '塞尔达传说：王国之泪'] });

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data).toEqual({ '123456': ['dota2', '塞尔达传说：王国之泪'] });
		});

		it('accepts an empty object', () => {
			const result = parseAidRules({});

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data).toEqual({});
		});

		it('accepts empty arrays as values', () => {
			const result = parseAidRules({ '123456': [] });

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data).toEqual({ '123456': [] });
		});

		it('accepts keys that do not exist in records', () => {
			const result = parseAidRules({ '99999999': ['杂谈'] });

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data).toEqual({ '99999999': ['杂谈'] });
		});

		it('rejects an array', () => {
			const result = parseAidRules([]);

			expect(result.success).toBe(false);
			if (result.success) return;
			expect(result.message).toContain('必须是一个对象');
		});

		it('rejects null', () => {
			const result = parseAidRules(null);

			expect(result.success).toBe(false);
		});

		it('rejects a value that is not an array', () => {
			const result = parseAidRules({ '123456': 'dota2' });

			expect(result.success).toBe(false);
			if (result.success) return;
			expect(result.message).toContain('123456 必须是字符串数组');
		});

		it('rejects an array containing a non-string', () => {
			const result = parseAidRules({ '123456': ['dota2', 42] });

			expect(result.success).toBe(false);
		});

		it('rejects an empty tag', () => {
			const result = parseAidRules({ '123456': ['dota2', ''] });

			expect(result.success).toBe(false);
			if (result.success) return;
			expect(result.message).toContain('123456.1 的游戏名不能为空');
		});

		it('dedupes repeated tags and keeps the first occurrence order', () => {
			const result = parseAidRules({ '123456': ['b', 'a', 'b', 'c', 'a'] });

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data).toEqual({ '123456': ['b', 'a', 'c'] });
		});

		it('dedupes each key independently', () => {
			const result = parseAidRules({ '1': ['a', 'a'], '2': ['a', 'b'] });

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data).toEqual({ '1': ['a'], '2': ['a', 'b'] });
		});
	});

	describe('validateAidRules', () => {
		it('passes valid rules through with dedupe applied', () => {
			const result = validateAidRules({ '123456': ['dota2', 'dota2'] });

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data).toEqual({ '123456': ['dota2'] });
		});

		it('returns VALIDATION_ERROR for a non-object body', () => {
			const result = validateAidRules('dota2');

			expect(result.success).toBe(false);
			if (result.success) return;
			expect(result.error).toBe('VALIDATION_ERROR');
		});

		it('returns VALIDATION_ERROR for an empty tag', () => {
			const result = validateAidRules({ '123456': [''] });

			expect(result.success).toBe(false);
			if (result.success) return;
			expect(result.error).toBe('VALIDATION_ERROR');
		});
	});
});
