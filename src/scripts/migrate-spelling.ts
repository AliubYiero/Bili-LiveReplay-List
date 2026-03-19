import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { DataPathManager } from '../utils/DataPathManager.ts';
import type { SpellingCorrectionConfig, SpellingRule } from '../interface/ISpellingCorrection.ts';

/**
 * 将 V1 格式的拼写纠正配置迁移到 V2 格式
 * V1: { "错误名称": "正确名称" }
 * V2: { version: "2.0", global: { rules: [...] }, uidRules: {} }
 */
export async function migrateSpellingCorrections(): Promise<void> {
	console.log('Starting SpellingCorrections migration...');

	const configPath = DataPathManager.getSpellingCorrectionPath();

	if (!existsSync(configPath)) {
		console.log('No existing config found. Creating default V2 config...');
		const defaultConfig: SpellingCorrectionConfig = {
			version: '2.0',
			global: { rules: [] },
			uidRules: {}
		};
		writeFileSync(configPath, JSON.stringify(defaultConfig, null, '\t'), 'utf-8');
		console.log('✓ Created default V2 config at:', configPath);
		return;
	}

	try {
		const content = readFileSync(configPath, 'utf-8');
		const parsed = JSON.parse(content);

		// 检查是否已经是 V2 格式
		if (parsed.version === '2.0') {
			console.log('Config is already in V2 format. No migration needed.');
			return;
		}

		// 验证是 V1 格式（简单的键值对）
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			console.error('✗ Invalid config format. Expected object.');
			process.exit(1);
		}

		// 转换为 V2 格式
		const rules: SpellingRule[] = Object.entries(parsed).map(([from, to]) => ({
			from,
			to: to as string
		}));

		const v2Config: SpellingCorrectionConfig = {
			version: '2.0',
			global: { rules },
			uidRules: {}
		};

		// 备份旧文件
		const backupPath = `${configPath}.v1.bak`;
		renameSync(configPath, backupPath);
		console.log('✓ Backed up old config to:', backupPath);

		// 写入新格式
		writeFileSync(configPath, JSON.stringify(v2Config, null, '\t'), 'utf-8');
		console.log('✓ Migrated to V2 format at:', configPath);
		console.log(`  - Converted ${rules.length} global rules`);
		console.log(`  - Added empty uidRules section for future use`);

	} catch (error) {
		console.error('✗ Migration failed:', error);
		process.exit(1);
	}

	console.log('\nMigration complete!');
	console.log('You can now add UID-specific rules to the "uidRules" section.');
}

// 直接运行迁移（当通过 CLI 调用时，不是在测试环境中）
if (process.env.NODE_ENV !== 'test') {
	migrateSpellingCorrections();
}
