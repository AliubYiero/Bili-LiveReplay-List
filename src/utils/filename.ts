import * as sanitizeModule from 'sanitize-filename';

/**
 * 将字符串转换为安全的文件名
 * 替换非法字符为下划线
 */
export function safeFilename(name: string): string {
  // 处理 CommonJS/ESM 互操作性问题
  const sanitize = (sanitizeModule as any).default || sanitizeModule;
  return sanitize(name, { replacement: '_' });
}
