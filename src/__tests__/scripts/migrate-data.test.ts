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
    // 使用 mock-fs 隔离文件系统
    mockFs({
      'config': {},
      'data': {}
    });
  });

  afterEach(() => {
    mockFs.restore();
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

    await migrateData();

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

    await migrateData();

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

    await migrateData();

    const newPath = join(cwd(), 'data', uid.toString(), `${uid}.record.json`);
    expect(existsSync(newPath)).toBe(true);
  });
});
