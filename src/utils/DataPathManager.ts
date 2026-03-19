import { cwd } from 'node:process';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'node:path';

export class DataPathManager {
  /**
   * 获取数据根目录
   */
  static getDataDir(): string {
    return resolve(cwd(), 'data');
  }

  /**
   * 获取用户数据目录（自动创建）
   */
  static getUserDataDir(uid: number): string {
    const userDir = join(this.getDataDir(), uid.toString());
    this.ensureDir(userDir);
    return userDir;
  }

  /**
   * 递归创建目录
   */
  private static ensureDir(dirPath: string): void {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }
}
