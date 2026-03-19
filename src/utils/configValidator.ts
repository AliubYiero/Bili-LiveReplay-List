import { z } from 'zod';
import type { SpellingCorrectionConfig } from '../interface/ISpellingCorrection.ts';

const SpellingCorrectionSchema = z.record(z.string());

/**
 * 验证拼写纠正配置文件
 * 验证失败时返回空对象并记录警告
 */
export function validateSpellingCorrection(data: unknown): Record<string, string> {
  const result = SpellingCorrectionSchema.safeParse(data);
  if (!result.success) {
    console.warn('配置文件格式错误，使用空配置:', result.error);
    return {};
  }
  return result.data;
}

// ==================== V2 Schema ====================

const SpellingRuleSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1)
});

const UidSpellingRulesSchema = z.object({
  rules: z.array(SpellingRuleSchema)
});

const SpellingCorrectionV2Schema = z.object({
  version: z.literal('2.0'),
  global: UidSpellingRulesSchema,
  uidRules: z.record(z.string(), UidSpellingRulesSchema)
});

export type SpellingCorrectionV2ValidationResult = 
  | { success: true; data: SpellingCorrectionConfig }
  | { success: false; error: z.ZodError };

/**
 * 验证 SpellingCorrection V2 配置文件
 * @param data 待验证的数据
 * @returns 验证结果
 */
export function validateSpellingCorrectionV2(
  data: unknown
): SpellingCorrectionV2ValidationResult {
  const result = SpellingCorrectionV2Schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}
