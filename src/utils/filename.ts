import sanitize from 'sanitize-filename';

/**
 * 将字符串转换为安全的文件名
 * 替换非法字符为下划线
 */
export function safeFilename(name: string): string {
  return sanitize(name, { replacement: '_' });
}
