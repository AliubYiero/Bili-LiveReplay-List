import { DataPathManager } from '../../../utils/DataPathManager';
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
});
