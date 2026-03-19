import { DataPathManager } from '../../../utils/DataPathManager';
import { safeFilename } from '../../../utils/filename';
import { existsSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import mockFs from 'mock-fs';

describe('DataPathManager', () => {
  beforeEach(() => {
    mockFs({
      'data': {},
      'config': {}
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  test('getDataDir returns correct path', () => {
    const result = DataPathManager.getDataDir();
    expect(result).toBe(join(cwd(), 'data'));
  });

  test('getUserDataDir creates directory and returns path', () => {
    const testUid = 12345678; // 使用测试专用 UID
    const result = DataPathManager.getUserDataDir(testUid);
    expect(result).toBe(join(cwd(), 'data', testUid.toString()));
    expect(existsSync(result)).toBe(true);
  });

  test('getRecordFilePath returns correct path', () => {
    const testUid = 12345678;
    const result = DataPathManager.getRecordFilePath(testUid, 'TestUser');
    expect(result).toBe(join(cwd(), 'data', testUid.toString(), 'TestUser.record.json'));
  });

  test('getAidFilePath returns correct path', () => {
    const testUid = 12345678;
    const result = DataPathManager.getAidFilePath(testUid, 'TestUser');
    expect(result).toBe(join(cwd(), 'data', testUid.toString(), 'TestUser.aid.json'));
  });

  test('getSpellingCorrectionPath returns correct path', () => {
    const result = DataPathManager.getSpellingCorrectionPath();
    expect(result).toBe(join(cwd(), 'data', 'SpellingCorrections.json'));
  });

  test('file paths use safeFilename for userName', () => {
    const testUid = 12345678;
    const result = DataPathManager.getRecordFilePath(testUid, '非法/字符');
    const safeName = safeFilename('非法/字符');
    expect(result).toBe(join(cwd(), 'data', testUid.toString(), `${safeName}.record.json`));
  });

  test('getLegacyRecordPath returns old config path', () => {
    const testUid = 12345678;
    const result = DataPathManager.getLegacyRecordPath(testUid);
    expect(result).toBe(join(cwd(), 'config', `${testUid}.record.json`));
  });

  test('getLegacyAidPath returns old config path', () => {
    const testUid = 12345678;
    const result = DataPathManager.getLegacyAidPath(testUid);
    expect(result).toBe(join(cwd(), 'config', `${testUid}.aid.json`));
  });

  test('getLegacySpellingCorrectionPath returns old config path', () => {
    const result = DataPathManager.getLegacySpellingCorrectionPath();
    expect(result).toBe(join(cwd(), 'config', 'SpellingCorrections.json'));
  });
});
