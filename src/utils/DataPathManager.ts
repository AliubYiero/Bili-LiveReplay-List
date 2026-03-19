import { cwd } from 'node:process';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'node:path';
import { safeFilename } from './filename.ts';

export interface UserFilePaths {
  recordPath: string;
  aidPath: string;
  userDir: string;
}

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
   * 获取 record.json 文件路径
   */
  static getRecordFilePath(uid: number, userName: string): string {
    const safeName = safeFilename(userName);
    return join(this.getUserDataDir(uid), `${safeName}.record.json`);
  }

  /**
   * 获取 aid.json 文件路径
   */
  static getAidFilePath(uid: number, userName: string): string {
    const safeName = safeFilename(userName);
    return join(this.getUserDataDir(uid), `${safeName}.aid.json`);
  }

  /**
   * 获取拼写纠正配置文件路径
   */
  static getSpellingCorrectionPath(): string {
    return join(this.getDataDir(), 'SpellingCorrections.json');
  }

  /**
   * 获取用户所有文件路径（统一接口）
   */
  static getUserFilePaths(uid: number, userName: string): UserFilePaths {
    const userDir = this.getUserDataDir(uid);
    const safeName = safeFilename(userName);
    return {
      userDir,
      recordPath: join(userDir, `${safeName}.record.json`),
      aidPath: join(userDir, `${safeName}.aid.json`),
    };
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
