import { DataPathManager } from '../../../utils/DataPathManager';
import { safeFilename } from '../../../utils/filename';
import { existsSync, rmdirSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';

describe('DataPathManager', () => {
  const testDataDir = join(cwd(), 'data');

  afterEach(() => {
    // 清理测试目录
    if (existsSync(testDataDir)) {
      rmdirSync(testDataDir, { recursive: true });
    }
  });

  test('getDataDir returns correct path', () => {
    const result = DataPathManager.getDataDir();
    expect(result).toBe(join(cwd(), 'data'));
  });

  test('getUserDataDir creates directory and returns path', () => {
    const result = DataPathManager.getUserDataDir(15810);
    expect(result).toBe(join(cwd(), 'data', '15810'));
    expect(existsSync(result)).toBe(true);
  });

  test('getRecordFilePath returns correct path', () => {
    const result = DataPathManager.getRecordFilePath(15810, 'Mr.Quin');
    expect(result).toBe(join(cwd(), 'data', '15810', 'Mr.Quin.record.json'));
  });

  test('getAidFilePath returns correct path', () => {
    const result = DataPathManager.getAidFilePath(15810, 'Mr.Quin');
    expect(result).toBe(join(cwd(), 'data', '15810', 'Mr.Quin.aid.json'));
  });

  test('getSpellingCorrectionPath returns correct path', () => {
    const result = DataPathManager.getSpellingCorrectionPath();
    expect(result).toBe(join(cwd(), 'data', 'SpellingCorrections.json'));
  });

  test('file paths use safeFilename for userName', () => {
    const result = DataPathManager.getRecordFilePath(15810, '非法/字符');
    const safeName = safeFilename('非法/字符');
    expect(result).toBe(join(cwd(), 'data', '15810', `${safeName}.record.json`));
  });

  test('getLegacyRecordPath returns old config path', () => {
    const result = DataPathManager.getLegacyRecordPath(15810);
    expect(result).toBe(join(cwd(), 'config', '15810.record.json'));
  });

  test('getLegacyAidPath returns old config path', () => {
    const result = DataPathManager.getLegacyAidPath(15810);
    expect(result).toBe(join(cwd(), 'config', '15810.aid.json'));
  });

  test('getLegacySpellingCorrectionPath returns old config path', () => {
    const result = DataPathManager.getLegacySpellingCorrectionPath();
    expect(result).toBe(join(cwd(), 'config', 'SpellingCorrections.json'));
  });
});
