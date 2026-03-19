import { lock } from 'proper-lockfile';
import { writeFileSync } from 'fs';

/**
 * 原子写入 JSON 文件
 * 使用文件锁防止并发写入冲突
 */
export async function atomicWriteJSON(filepath: string, data: unknown): Promise<void> {
  const release = await lock(filepath, { retries: 3 });
  try {
    writeFileSync(filepath, JSON.stringify(data), 'utf8');
  } finally {
    await release();
  }
}
