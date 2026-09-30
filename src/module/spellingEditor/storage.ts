import { existsSync, readFileSync } from 'fs';
import { DataPathManager } from '../../utils/DataPathManager.ts';
import type { SpellingCorrectionConfig, SpellingRule } from '../../interface/ISpellingCorrection.ts';
import { parseConfig, validateConfig } from './validator.ts';
import { acquireLock, GlobalRuleConflictError, persistJson, SpellingEditorError } from './editorCommon.ts';

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
 * 整体替换指定 UID 的专属规则，不存在则创建分组
 * 与 saveUidRules 的区别只有「不存在时是报错还是新建」，供「游戏纠错」页面使用
 */
export async function upsertUidRules( uid: string, rules: SpellingRule[] ): Promise<void> {
	await withLockedConfig( config => ( {
		...config,
		uidRules: {
			...config.uidRules,
			[ uid ]: { rules }
		}
	} ) );
}

/**
 * 把某条 UID 规则提升为全局规则
 *
 * 移动语义：成功时该条会从 uidRules 中移除。删除与写入在同一锁周期内完成，
 * 不会出现「全局有了、uid 还留着」的中间态。
 *
 * @param overwrite 全局已存在同 from 但 to 不同时，是否覆盖；不覆盖则抛 GlobalRuleConflictError
 */
export async function promoteRuleToGlobal(
	uid: string,
	from: string,
	to: string,
	overwrite = false
): Promise<void> {
	await withLockedConfig( config => {
		const uidRules = config.uidRules[ uid ]?.rules;

		if ( !uidRules ) {
			throw new SpellingEditorError( 'VALIDATION_ERROR', `UID ${uid} 还没有专属规则，无从提升` );
		}

		// 必须与 uid 规则完全一致才允许提升，避免前端拿着过期数据把 to 改掉
		const index = uidRules.findIndex( rule => rule.from === from && rule.to === to );
		if ( index === -1 ) {
			throw new SpellingEditorError(
				'VALIDATION_ERROR',
				`UID ${uid} 的规则中不存在「${from} → ${to}」，请先保存再提升`
			);
		}

		const globalRules = [ ...config.global.rules ];
		const globalIndex = globalRules.findIndex( rule => rule.from === from );

		if ( globalIndex === -1 ) {
			globalRules.push( { from, to } );
		} else if ( globalRules[ globalIndex ].to === to ) {
			// to 相同：全局已经是想要的结果，静默移除 uid 规则即可
		} else if ( !overwrite ) {
			throw new GlobalRuleConflictError( globalRules[ globalIndex ].to );
		} else {
			globalRules[ globalIndex ] = { from, to };
		}

		return {
			...config,
			global: { rules: globalRules },
			uidRules: {
				...config.uidRules,
				[ uid ]: { rules: uidRules.filter( ( _rule, i ) => i !== index ) }
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
