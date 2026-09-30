import { copyFileSync, existsSync, writeFileSync, renameSync } from 'fs';
import { lock } from 'proper-lockfile';
import type { SpellingEditorErrorType } from './validator.ts';

/** 锁冲突重试次数 */
export const LOCK_RETRIES = 3;
/** 锁冲突重试间隔（毫秒） */
export const LOCK_RETRY_DELAY = 100;
/** 写文件时使用的缩进，与现有配置文件和存储层保持一致 */
export const JSON_INDENT = '\t';

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
 * 提升到全局时目标 from 已被全局规则占用且 to 不同
 * 单独建类是为了把 existingTo 一并带回前端，供 confirm 文案使用
 */
export class GlobalRuleConflictError extends SpellingEditorError {
	/** 全局规则中该 from 当前对应的 to */
	readonly existingTo: string;

	constructor( existingTo: string ) {
		super( 'GLOBAL_RULE_CONFLICT', `全局规则中已存在该游戏名，当前纠正为「${existingTo}」` );
		this.name = 'GlobalRuleConflictError';
		this.existingTo = existingTo;
	}
}

/**
 * 获取文件锁，失败时自动重试
 * proper-lockfile 在文件被占用时抛 code 为 ELOCKED 的错误
 * 注意：目标文件必须已存在，否则 proper-lockfile 无法创建锁目录
 */
export async function acquireLock( filePath: string ): Promise<() => Promise<void>> {
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
 * 备份旧文件后原子写入新内容
 * 先写临时文件再重命名，避免写入中断导致文件残缺
 */
export function persistJson( filePath: string, data: unknown ): void {
	if ( existsSync( filePath ) ) {
		copyFileSync( filePath, `${filePath}.bak` );
	}

	const tempPath = `${filePath}.tmp`;
	writeFileSync( tempPath, JSON.stringify( data, null, JSON_INDENT ), 'utf-8' );
	renameSync( tempPath, filePath );
}
