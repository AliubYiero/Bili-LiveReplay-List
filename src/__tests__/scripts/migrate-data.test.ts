import { migrateData } from '../../scripts/migrate-data';
import { DataPathManager } from '../../utils/DataPathManager';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import mockFs from 'mock-fs';
import { mkdirSync, writeFileSync } from 'fs';

describe('migrate-data', () => {
  const configDir = join(cwd(), 'config');
  const dataDir = join(cwd(), 'data');

  beforeEach(() => {
    // 使用 mock-fs 隔离文件系统，但保留 node_modules 以避免拦截 Jest 内部文件
    mockFs({
      'config': {},
      'data': {},
      'node_modules': mockFs.load(join(cwd(), 'node_modules'))
    });
  });

  afterEach(() => {
    mockFs.restore();
    jest.restoreAllMocks();
  });

  test('migrates record.json with userName', async () => {
    const uid = 12345678; // 使用测试专用 UID
    const userName = 'TestUser';
    const oldPath = join(configDir, `${uid}.record.json`);
    const recordData = {
      cache: { uid, userName, aid: 123, timestamp: Date.now() },
      records: []
    };

    // 在 mock-fs 中创建文件需要先创建目录再写入
    writeFileSync(oldPath, JSON.stringify(recordData));

    await migrateData({ execute: true });

    const newPath = DataPathManager.getRecordFilePath(uid, userName);
    expect(existsSync(newPath)).toBe(true);

    const migratedContent = JSON.parse(readFileSync(newPath, 'utf-8'));
    expect(migratedContent.cache.userName).toBe(userName);
  });

  test('migrates aid.json with corresponding record userName', async () => {
    const uid = 12345679; // 使用不同的测试专用 UID
    const userName = 'TestUser2';

    // 创建 record.json
    const recordData = {
      cache: { uid, userName, aid: 123, timestamp: Date.now() },
      records: []
    };
    writeFileSync(join(configDir, `${uid}.record.json`), JSON.stringify(recordData));

    // 创建 aid.json
    const aidData = { '123': ['game1', 'game2'] };
    writeFileSync(join(configDir, `${uid}.aid.json`), JSON.stringify(aidData));

    await migrateData({ execute: true });

    const newAidPath = DataPathManager.getAidFilePath(uid, userName);
    expect(existsSync(newAidPath)).toBe(true);
  });

  test('uses uid as fallback when userName is missing', async () => {
    const uid = 12345680; // 使用另一个测试专用 UID
    const oldPath = join(configDir, `${uid}.record.json`);
    const recordData = {
      cache: { uid, aid: 123, timestamp: Date.now() }, // 没有 userName
      records: []
    };
    writeFileSync(oldPath, JSON.stringify(recordData));

    await migrateData({ execute: true });

    const newPath = join(cwd(), 'data', uid.toString(), `${uid}.record.json`);
    expect(existsSync(newPath)).toBe(true);
  });

  test('should skip execution when execute is false', async () => {
    // 这个测试主要验证 { execute: false } 不会报错
    await expect(migrateData({ execute: false })).resolves.toBeUndefined();
  });

  test('should handle missing config directory', async () => {
    // 模拟 config 目录不存在
    mockFs.restore();
    mockFs({
      'data': {},
      'node_modules': mockFs.load(join(cwd(), 'node_modules'))
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await migrateData({ execute: true });

    expect(consoleErrorSpy).toHaveBeenCalledWith('config/ directory not found');
  });

  test('should handle JSON parse error gracefully', async () => {
    const uid = 12345681;
    const oldPath = join(configDir, `${uid}.record.json`);

    // 创建格式错误的 JSON 文件
    writeFileSync(oldPath, 'invalid json content');

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await migrateData({ execute: true });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorCall = consoleErrorSpy.mock.calls.find(
      call => call[0].includes && call[0].includes('Failed to migrate')
    );
    expect(errorCall).toBeDefined();
    expect(errorCall![0]).toContain(`${uid}.record.json`);
  });

  test('should migrate both record.json and aid.json with correct paths', async () => {
    const uid = 12345682;
    const userName = 'TestUser3';

    // 创建 record.json
    const recordData = {
      cache: { uid, userName, aid: 123, timestamp: Date.now() },
      records: []
    };
    writeFileSync(join(configDir, `${uid}.record.json`), JSON.stringify(recordData));

    // 创建 aid.json
    const aidData = { '123': ['game1', 'game2'] };
    writeFileSync(join(configDir, `${uid}.aid.json`), JSON.stringify(aidData));

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    await migrateData({ execute: true });

    // 验证两个文件都被迁移
    const newRecordPath = DataPathManager.getRecordFilePath(uid, userName);
    const newAidPath = DataPathManager.getAidFilePath(uid, userName);

    expect(existsSync(newRecordPath)).toBe(true);
    expect(existsSync(newAidPath)).toBe(true);

    // 验证日志输出
    expect(consoleLogSpy).toHaveBeenCalledWith('Starting data migration...');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found'));
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Migrated ${uid}.record.json`)
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Migrated ${uid}.aid.json`)
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('\nMigration complete!');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Please verify the migration before deleting config/ directory'
    );
  });

  test('should migrate record.json without corresponding aid.json', async () => {
    const uid = 12345683;
    const userName = 'TestUser4';

    // 只创建 record.json，不创建 aid.json
    const recordData = {
      cache: { uid, userName, aid: 123, timestamp: Date.now() },
      records: []
    };
    writeFileSync(join(configDir, `${uid}.record.json`), JSON.stringify(recordData));

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    await migrateData({ execute: true });

    // 验证 record.json 被迁移
    const newRecordPath = DataPathManager.getRecordFilePath(uid, userName);
    expect(existsSync(newRecordPath)).toBe(true);

    // 验证没有 aid.json 的迁移日志
    const aidMigrationLogs = consoleLogSpy.mock.calls.filter(
      call => call[0].includes && call[0].includes('.aid.json')
    );
    expect(aidMigrationLogs).toHaveLength(0);
  });
});
