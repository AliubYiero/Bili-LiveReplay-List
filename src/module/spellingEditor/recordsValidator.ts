import { z } from 'zod';
import type { ZodError } from 'zod';

/**
 * aid.json 的数据模型
 * key 为 String(aid)，value 为该录播最终使用的游戏名数组
 * 空数组表示「没有人工映射」，主程序会回退到自动解析的 record.playGame
 */
export type AidRules = Record<string, string[]>;

/** 读取现有文件时的解析结果（宽松：只要求结构合法） */
export type ParseAidResult =
	| { success: true; data: AidRules }
	| { success: false; message: string };

/** 写入前校验结果 */
export type ValidateAidResult =
	| { success: true; data: AidRules }
	| { success: false; error: 'VALIDATION_ERROR'; message: string };

/**
 * 结构校验：非 null、非数组的普通对象，value 必须是字符串数组
 * 标签非空；允许空数组；不限制 key 必须存在于 records 中，允许保留额外 key
 */
const aidRulesSchema = z.record(
	z.string(),
	z.array( z.string().min( 1 ) )
);

/**
 * 仅校验结构合法性
 * 用于读取现有 aid.json：即使文件里有重复标签，也要让编辑页面能正常打开
 */
export function parseAidRules( data: unknown ): ParseAidResult {
	const result = aidRulesSchema.safeParse( data );

	if ( !result.success ) {
		return { success: false, message: formatAidError( result.error ) };
	}

	return { success: true, data: dedupeAidRules( result.data ) };
}

/**
 * 写入前校验
 * 标签静默去重（前端已去重，这里是兜底），保留首次出现的顺序
 */
export function validateAidRules( data: unknown ): ValidateAidResult {
	const parsed = parseAidRules( data );

	if ( !parsed.success ) {
		return { success: false, error: 'VALIDATION_ERROR', message: parsed.message };
	}

	return { success: true, data: parsed.data };
}

/**
 * 把 zod 的报错整理成人类可读的单行信息
 * 文案比通用的 formatZodError 更贴合 aid.json 的语义
 */
function formatAidError( error: ZodError ): string {
	return error.issues
		.map( issue => {
			const path = issue.path.join( '.' ) || '(根)';

			if ( issue.code === 'too_small' ) {
				return `${path} 的游戏名不能为空`;
			}

			if ( issue.code === 'invalid_type' ) {
				return issue.path.length === 0
					? 'aid.json 必须是一个对象'
					: `${path} 必须是字符串数组`;
			}

			return `${path} ${issue.message}`;
		} )
		.join( '; ' );
}

/**
 * 同一 aid 下的重复标签去重，保留首次出现的顺序
 */
function dedupeAidRules( rules: AidRules ): AidRules {
	const next: AidRules = {};

	for ( const [ aid, games ] of Object.entries( rules ) ) {
		// 用 indexOf 而不是 Set：tsconfig 未设 target，展开 Set 会触发 downlevelIteration 报错
		next[ aid ] = games.filter( ( game, index ) => games.indexOf( game ) === index );
	}

	return next;
}
