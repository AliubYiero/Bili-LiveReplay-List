import type { ZodError } from 'zod';
import { validateSpellingCorrectionV2 } from '../../utils/configValidator.ts';
import type { SpellingCorrectionConfig, SpellingRule } from '../../interface/ISpellingCorrection.ts';

/**
 * 编辑器可返回的错误类型
 * 与设计稿第 6 节的错误表一一对应
 */
export type SpellingEditorErrorType =
	| 'VALIDATION_ERROR'
	| 'DUPLICATE_FROM'
	| 'UID_NOT_FOUND'
	| 'LOCKED'
	| 'INTERNAL_ERROR';

/** 配置结构解析结果（只校验结构，不校验 from 唯一性） */
export type ParseConfigResult =
	| { success: true; data: SpellingCorrectionConfig }
	| { success: false; message: string };

/** 写入前校验结果（结构 + 同作用域内 from 唯一） */
export type ValidateConfigResult =
	| { success: true; data: SpellingCorrectionConfig }
	| { success: false; error: 'VALIDATION_ERROR' | 'DUPLICATE_FROM'; message: string };

/**
 * 查找同一作用域内重复的 from
 * @param rules 待检查的规则列表
 * @returns 首次出现重复的 from；没有重复时返回 null
 */
export function findDuplicateFrom( rules: SpellingRule[] ): string | null {
	const seen = new Set<string>();

	for ( const rule of rules ) {
		if ( seen.has( rule.from ) ) {
			return rule.from;
		}
		seen.add( rule.from );
	}

	return null;
}

/**
 * 仅校验 V2 结构合法性，不校验 from 唯一性
 * 用于读取现有配置：即使文件里存在历史遗留的重复 from，也要让编辑页面能正常打开
 */
export function parseConfig( data: unknown ): ParseConfigResult {
	const result = validateSpellingCorrectionV2( data );

	if ( !result.success ) {
		return { success: false, message: formatZodError( result.error ) };
	}

	return { success: true, data: result.data };
}

/**
 * 写入前校验：结构合法性 + 同作用域内 from 不重复
 * global 与 uidRules 之间允许出现相同的 from，符合 V2 链式纠错设计
 */
export function validateConfig( data: unknown ): ValidateConfigResult {
	const parsed = parseConfig( data );

	if ( !parsed.success ) {
		return { success: false, error: 'VALIDATION_ERROR', message: parsed.message };
	}

	const config = parsed.data;

	const globalDuplicate = findDuplicateFrom( config.global.rules );
	if ( globalDuplicate !== null ) {
		return {
			success: false,
			error: 'DUPLICATE_FROM',
			message: `全局规则中存在重复的 from："${globalDuplicate}"`
		};
	}

	for ( const [ uid, uidConfig ] of Object.entries( config.uidRules ) ) {
		const duplicate = findDuplicateFrom( uidConfig.rules );
		if ( duplicate !== null ) {
			return {
				success: false,
				error: 'DUPLICATE_FROM',
				message: `UID ${uid} 的规则中存在重复的 from："${duplicate}"`
			};
		}
	}

	return { success: true, data: config };
}

/**
 * 把 zod 的报错整理成人类可读的单行信息
 * 空字符串会转成「不能为空」，直接对应验收标准 V7 的提示文案
 */
function formatZodError( error: ZodError ): string {
	return error.issues
		.map( issue => {
			const path = issue.path.join( '.' ) || '(根)';

			if ( issue.code === 'too_small' ) {
				return `${path} 不能为空`;
			}

			return `${path} ${issue.message}`;
		} )
		.join( '; ' );
}
