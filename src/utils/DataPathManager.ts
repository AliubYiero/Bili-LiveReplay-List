import { cwd } from 'node:process';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'node:path';
import { safeFilename } from './filename.ts';

export interface UserFilePaths {
  recordPath: string;
  aidPath: string;
  userDir: string;
}

/** UID 在数据中以数字或字符串形式出现，两种都接受 */
export type UserId = number | string;

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
  static getUserDataDir(uid: UserId): string {
    const userDir = this.resolveUserDir(uid);
    this.ensureDir(userDir);
    return userDir;
  }

  /**
   * 获取 record.json 文件路径
   */
  static getRecordFilePath(uid: UserId, userName: string): string {
    return this.getUserFilePaths(uid, userName).recordPath;
  }

  /**
   * 获取 aid.json 文件路径
   */
  static getAidFilePath(uid: UserId, userName: string): string {
    return this.getUserFilePaths(uid, userName).aidPath;
  }

  /**
   * 获取拼写纠正配置文件路径
   */
  static getSpellingCorrectionPath(): string {
    return join(this.getDataDir(), 'SpellingCorrections.json');
  }

  /**
   * 获取用户所有文件路径（统一接口，会创建目录）
   */
  static getUserFilePaths(uid: UserId, userName: string): UserFilePaths {
    return this.buildUserFilePaths(this.getUserDataDir(uid), userName);
  }

  /**
   * 解析用户所有文件路径（只读，不创建目录）
   * 扫描类操作必须用它——扫描不该因为读一个不存在的用户而凭空建出空目录
   */
  static resolveUserFilePaths(uid: UserId, userName: string): UserFilePaths {
    return this.buildUserFilePaths(this.resolveUserDir(uid), userName);
  }

  /**
   * 解析用户目录路径（只读，不创建）
   */
  private static resolveUserDir(uid: UserId): string {
    return join(this.getDataDir(), uid.toString());
  }

  /**
   * 由用户目录拼出各文件路径
   */
  private static buildUserFilePaths(userDir: string, userName: string): UserFilePaths {
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
