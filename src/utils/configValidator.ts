import { z } from 'zod';

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
