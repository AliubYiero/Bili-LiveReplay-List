import { DataPathManager } from '../utils/DataPathManager.js';
import { existsSync, readdirSync, readFileSync, mkdirSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { cwd } from 'process';

interface IRecord {
  cache: {
    uid: number;
    userName?: string;
    aid: number;
    timestamp: number;
  };
  records: unknown[];
}

export async function migrateData(): Promise<void> {
  console.log('Starting data migration...');

  const configDir = join(cwd(), 'config');

  if (!existsSync(configDir)) {
    console.error('config/ directory not found');
    return;
  }

  const files = readdirSync(configDir);
  const recordFiles = files.filter(f => f.endsWith('.record.json'));

  console.log(`Found ${recordFiles.length} record files to migrate`);

  for (const recordFile of recordFiles) {
    const uid = parseInt(recordFile.replace('.record.json', ''));
    const oldRecordPath = join(configDir, recordFile);

    try {
      const content = readFileSync(oldRecordPath, 'utf-8');
      const data: IRecord = JSON.parse(content);
      const userName = data.cache?.userName || uid.toString();

      // 创建新目录
      const userDir = DataPathManager.getUserDataDir(uid);
      if (!existsSync(userDir)) {
        mkdirSync(userDir, { recursive: true });
      }

      // 迁移 record.json
      const newRecordPath = DataPathManager.getRecordFilePath(uid, userName);
      copyFileSync(oldRecordPath, newRecordPath);
      console.log(`✓ Migrated ${recordFile} → ${userName}.record.json`);

      // 迁移对应的 aid.json
      const oldAidPath = join(configDir, `${uid}.aid.json`);
      if (existsSync(oldAidPath)) {
        const newAidPath = DataPathManager.getAidFilePath(uid, userName);
        copyFileSync(oldAidPath, newAidPath);
        console.log(`✓ Migrated ${uid}.aid.json → ${userName}.aid.json`);
      }
    } catch (error) {
      console.error(`✗ Failed to migrate ${recordFile}:`, error);
    }
  }

  console.log('\nMigration complete!');
  console.log('Please verify the migration before deleting config/ directory');
}

// 只在直接运行此文件时执行迁移
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateData();
}
