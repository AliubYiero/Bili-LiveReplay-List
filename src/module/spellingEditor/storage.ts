import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { lock } from 'proper-lockfile';
import { DataPathManager } from '../../utils/DataPathManager.ts';
import type { SpellingCorrectionConfig, SpellingRule } from '../../interface/ISpellingCorrection.ts';
import { parseConfig, validateConfig, type SpellingEditorErrorType } from './validator.ts';

/** 锁冲突重试次数 */
const LOCK_RETRIES = 3;
/** 锁冲突重试间隔（毫秒） */
const LOCK_RETRY_DELAY = 100;
/** 写文件时使用的缩进，与现有配置文件和迁移脚本保持一致 */
const JSON_INDENT = '\t';

/**
 * 编辑器运行时错误
 * type 决定 HTTP 状态码，message 会直接展示给用户
 */
export class SpellingEditorError extends Error {
	readonly type: SpellingEditorErrorType;

	constructor( type: SpellingEditorErrorType, message: string ) {
		super( message );
		this.name = 'SpellingEditorError';
		this.type = type;
	}
}

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

		persistConfig( filePath, validationResult.data );
	} finally {
		await release();
	}
}

/**
 * 获取文件锁，失败时自动重试
 * proper-lockfile 在文件被占用时抛 code 为 ELOCKED 的错误
 */
async function acquireLock( filePath: string ): Promise<() => Promise<void>> {
	try {
		return await lock( filePath, {
			retries: {
				retries: LOCK_RETRIES,
				factor: 1,
				minTimeout: LOCK_RETRY_DELAY,
				maxTimeout: LOCK_RETRY_DELAY
			}
		} );
	} catch ( error ) {
		if ( ( error as NodeJS.ErrnoException ).code === 'ELOCKED' ) {
			throw new SpellingEditorError( 'LOCKED', '文件正在被其他进程修改，请稍后重试' );
		}

		throw new SpellingEditorError( 'INTERNAL_ERROR', `获取文件锁失败: ${( error as Error ).message }` );
	}
}

/**
 * 备份旧文件后原子写入新配置
 * 先写临时文件再重命名，避免写入中断导致配置文件残缺
 */
function persistConfig( filePath: string, config: SpellingCorrectionConfig ): void {
	if ( existsSync( filePath ) ) {
		copyFileSync( filePath, `${filePath}.bak` );
	}

	const tempPath = `${filePath}.tmp`;
	writeFileSync( tempPath, JSON.stringify( config, null, JSON_INDENT ), 'utf-8' );
	renameSync( tempPath, filePath );
}
