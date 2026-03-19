import { migrateData } from '../../scripts/migrate-data';
import { DataPathManager } from '../../utils/DataPathManager';
import { existsSync, writeFileSync, mkdirSync, rmdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';

describe('migrate-data', () => {
  const configDir = join(cwd(), 'config');
  const dataDir = join(cwd(), 'data');

  beforeEach(() => {
    // 清理 data 目录
    if (existsSync(dataDir)) {
      rmdirSync(dataDir, { recursive: true });
    }

    // 创建测试用的旧数据
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(dataDir)) {
      rmdirSync(dataDir, { recursive: true });
    }
  });

  test('migrates record.json with userName', async () => {
    const uid = 15810;
    const userName = 'Mr.Quin';
    const oldPath = join(configDir, `${uid}.record.json`);
    const recordData = {
      cache: { uid, userName, aid: 123, timestamp: Date.now() },
      records: []
    };
    writeFileSync(oldPath, JSON.stringify(recordData));

    await migrateData();

    const newPath = DataPathManager.getRecordFilePath(uid, userName);
    expect(existsSync(newPath)).toBe(true);

    const migratedContent = JSON.parse(readFileSync(newPath, 'utf-8'));
    expect(migratedContent.cache.userName).toBe(userName);
  });

  test('migrates aid.json with corresponding record userName', async () => {
    const uid = 15810;
    const userName = 'Mr.Quin';

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
    const uid = 99999;
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
