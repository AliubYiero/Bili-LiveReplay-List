import { existsSync, readFileSync } from 'fs';
import { DataPathManager } from '../../utils/DataPathManager.ts';
import type { SpellingCorrectionConfig, SpellingRule } from '../../interface/ISpellingCorrection.ts';
import { parseConfig, validateConfig } from './validator.ts';
import { acquireLock, persistJson, SpellingEditorError } from './editorCommon.ts';

// 错误类已提取到 editorCommon.ts，此处 re-export 保持原有 import 路径可用
export { SpellingEditorError } from './editorCommon.ts';

/**
 * 读取并解析当前配置文件
 * 只校验结构，不校验 from 唯一性，保证历史遗留的重复规则也能被页面加载出来
 */
export function readConfig(): SpellingCorrectionConfig {
	const filePath = DataPathManager.getSpellingCorrectionPath();

	if ( !existsSync( filePath ) ) {
		throw new SpellingEditorError( 'INTERNAL_ERROR', `配置文件不存在: ${filePath}` );
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse( readFileSync( filePath, 'utf-8' ) );
	} catch ( error ) {
		throw new SpellingEditorError( 'INTERNAL_ERROR', `配置文件不是合法 JSON: ${( error as Error ).message }` );
	}

	const result = parseConfig( parsed );
	if ( !result.success ) {
		throw new SpellingEditorError( 'INTERNAL_ERROR', `现有配置文件不符合 V2 结构: ${result.message}` );
	}

	return result.data;
}

/** 读取完整配置（供 GET /api/spelling 使用） */
export function getConfig(): SpellingCorrectionConfig {
	return readConfig();
}

/**
 * 保存全局规则
 */
export async function saveGlobalRules( rules: SpellingRule[] ): Promise<void> {
	await withLockedConfig( config => ( {
		...config,
		global: { rules }
	} ) );
}

/**
 * 保存指定 UID 的专属规则
 * UID 不存在时抛 UID_NOT_FOUND，不做隐式新建分组
 */
export async function saveUidRules( uid: string, rules: SpellingRule[] ): Promise<void> {
	await withLockedConfig( config => {
		if ( !Object.prototype.hasOwnProperty.call( config.uidRules, uid ) ) {
			throw new SpellingEditorError( 'UID_NOT_FOUND', `配置中不存在 UID ${uid} 的专属规则分组` );
		}

		return {
			...config,
			uidRules: {
				...config.uidRules,
				[ uid ]: { rules }
			}
		};
	} );
}

/**
 * 整体保存完整配置（后备 / 调试接口）
 */
export async function saveFullConfig( config: SpellingCorrectionConfig ): Promise<void> {
	await withLockedConfig( () => config );
}

/**
 * 加锁 → 读取 → 替换 → 校验 → 备份 → 原子写入 → 释放锁
 * mutate 返回的配置会先经过完整校验，再以 zod 清洗后的结果落盘
 */
async function withLockedConfig(
	mutate: ( config: SpellingCorrectionConfig ) => SpellingCorrectionConfig
): Promise<void> {
	const filePath = DataPathManager.getSpellingCorrectionPath();
	const release = await acquireLock( filePath );

	try {
		const next = mutate( readConfig() );

		const validationResult = validateConfig( next );
		if ( !validationResult.success ) {
			throw new SpellingEditorError( validationResult.error, validationResult.message );
		}

		persistJson( filePath, validationResult.data );
	} finally {
		await release();
	}
}
