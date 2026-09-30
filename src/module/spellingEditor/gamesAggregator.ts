import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'node:path';
import { DataPathManager } from '../../utils/DataPathManager.ts';
import type { IRecord } from '../../interface/IRecord.ts';
import type { SpellingRule } from '../../interface/ISpellingCorrection.ts';
import { SpellingEditorError } from './editorCommon.ts';
import { RECORD_SUFFIX } from './recordsStorage.ts';
import { readConfig } from './storage.ts';

/**
 * 链式纠错的来源标记
 *
 * `uid+global` 是 uid 规则命中后、其结果又被全局规则二次纠正的情况，
 * 对应 SpellingCorrection.correct() 的两步串联查找
 */
export type FinalSource = 'none' | 'uid' | 'global' | 'uid+global';

/** 聚合后的一行：某个原始游戏名在数据中的出现情况与纠错状态 */
export interface AggregatedGame {
	/** 数据中出现过的原始游戏名 */
	rawName: string;
	/** 总出现次数（同一条 record 内重复出现也各计一次） */
	occurrences: number;
	/** 最后一次出现时的遍历序号，用于排序 */
	lastIndex: number;
	/** UID 规则中匹配原始名的那条；null 表示没有 */
	uidRule: { to: string } | null;
	/** 实际生效的全局规则（对 uid 结果做的二次查找）；null 表示全局没参与 */
	globalRule: { to: string } | null;
	/**
	 * 被 uid 规则挡住的全局纠正值：全局规则对「原始名」的匹配结果，仅在 uid 规则
	 * 确实改动了名字时有值。仅用于 tooltip——主程序最终不会用它
	 */
	shadowedGlobalTo: string | null;
	/** 按 correct() 语义算出的最终结果 */
	finalName: string;
	finalSource: FinalSource;
}

/** GET /api/games/:uid 的响应体 */
export interface GamesAggregation {
	uid: string;
	games: AggregatedGame[];
	/** 该 uid 的完整规则，含数据中未出现的孤儿规则——前端以此为保存基线，避免整页提交时丢数据 */
	rules: SpellingRule[];
	/** 全局规则映射，供前端在编辑时就地重算最终结果，无需回后端 */
	globalRules: Record<string, string>;
}

/**
 * 列出「存在 *.record.json」的 uid
 * 不要求 aid.json——「游戏纠错」只关心录播数据本身
 * 全程只读，扫描不会凭空创建目录
 */
export function listRecordUids(): string[] {
	const dataDir = DataPathManager.getDataDir();

	if ( !existsSync( dataDir ) ) {
		return [];
	}

	const uids: string[] = [];

	for ( const entry of readdirSync( dataDir, { withFileTypes: true } ) ) {
		// data/ 根下还有 SpellingCorrections.json 等文件，只认数字命名的用户目录
		if ( !entry.isDirectory() || !/^\d+$/.test( entry.name ) ) {
			continue;
		}

		if ( findRecordFiles( join( dataDir, entry.name ) ).length === 0 ) {
			continue;
		}

		uids.push( entry.name );
	}

	return uids.sort( ( a, b ) => Number( a ) - Number( b ) );
}

/**
 * 聚合指定 uid 的全部 playGame，并算出每条的链式纠错结果
 *
 * 链式语义必须与 SpellingCorrection.correct() 保持一致：
 *   1. 用原始名查 UID 规则，命中则替换
 *   2. 用**第 1 步的结果**查全局规则，命中则再替换
 * 因此 uid 命中并不代表终止——全局规则仍可能改写它。
 *
 * @throws SpellingEditorError USER_NOT_FOUND 该 uid 下没有任何 record.json
 */
export function aggregateUserGames( uid: string ): GamesAggregation {
	const userDir = join( DataPathManager.getDataDir(), uid );

	if ( !existsSync( userDir ) ) {
		throw new SpellingEditorError( 'USER_NOT_FOUND', `找不到 UID ${uid} 的数据目录` );
	}

	const files = findRecordFiles( userDir );

	if ( files.length === 0 ) {
		throw new SpellingEditorError( 'USER_NOT_FOUND', `UID ${uid} 下没有任何录播数据文件` );
	}

	const stats = collectGameStats( userDir, files );

	const config = readConfig();
	const uidRules = config.uidRules[ uid ]?.rules ?? [];

	const uidMap = toRuleMap( uidRules );
	const globalMap = toRuleMap( config.global.rules );

	const games: AggregatedGame[] = [];
	stats.forEach( ( stat, rawName ) => {
		games.push( buildAggregatedGame( rawName, stat, uidMap, globalMap ) );
	} );

	// 最近出现过的排在最前
	games.sort( ( a, b ) => b.lastIndex - a.lastIndex );

	return {
		uid,
		games,
		rules: uidRules,
		globalRules: mapToRecord( globalMap )
	};
}

// ==================== 内部实现 ====================

interface GameStat {
	occurrences: number;
	lastIndex: number;
}

/**
 * 合并该 uid 下所有 record.json 的 playGame
 * 文件名排序保证 lastIndex 在多次调用间稳定
 */
function collectGameStats( userDir: string, files: string[] ): Map<string, GameStat> {
	const stats = new Map<string, GameStat>();
	let index = 0;

	for ( const file of files ) {
		const record = parseRecordFile( join( userDir, file ) );

		for ( const item of record.records ) {
			if ( !Array.isArray( item?.playGame ) ) {
				continue;
			}

			for ( const rawName of item.playGame ) {
				if ( typeof rawName !== 'string' || rawName === '' ) {
					continue;
				}

				const stat = stats.get( rawName );

				if ( stat ) {
					stat.occurrences += 1;
					stat.lastIndex = index;
				} else {
					stats.set( rawName, { occurrences: 1, lastIndex: index } );
				}

				index += 1;
			}
		}
	}

	return stats;
}

/** 按 correct() 的两步串联算出最终结果与来源标记 */
function buildAggregatedGame(
	rawName: string,
	stat: GameStat,
	uidMap: Map<string, string>,
	globalMap: Map<string, string>
): AggregatedGame {
	const uidTo = uidMap.get( rawName );
	// 第一步：UID 规则，未命中则保持原名
	const step1 = uidTo ?? rawName;
	// 第二步：用中间结果查全局规则
	const globalTo = globalMap.get( step1 );

	return {
		rawName,
		occurrences: stat.occurrences,
		lastIndex: stat.lastIndex,
		uidRule: uidTo === undefined ? null : { to: uidTo },
		globalRule: globalTo === undefined ? null : { to: globalTo },
		shadowedGlobalTo: uidTo !== undefined && step1 !== rawName
			? globalMap.get( rawName ) ?? null
			: null,
		finalName: globalTo ?? step1,
		finalSource: describeSource( uidTo !== undefined, globalTo !== undefined )
	};
}

function describeSource( uidHit: boolean, globalHit: boolean ): FinalSource {
	if ( uidHit && globalHit ) {
		return 'uid+global';
	}

	if ( uidHit ) {
		return 'uid';
	}

	return globalHit ? 'global' : 'none';
}

/**
 * 规则数组转查找表
 * 同一 from 出现多次时后者胜出，与 SpellingCorrection.loadConfig 的 Map 构造一致
 */
function toRuleMap( rules: SpellingRule[] ): Map<string, string> {
	const map = new Map<string, string>();

	for ( const rule of rules ) {
		map.set( rule.from, rule.to );
	}

	return map;
}

/** 用 foreach 而不是展开迭代器：tsconfig 未设 target，迭代 Map 会触发 downlevelIteration 报错 */
function mapToRecord( map: Map<string, string> ): Record<string, string> {
	const result: Record<string, string> = {};
	map.forEach( ( value, key ) => {
		result[ key ] = value;
	} );
	return result;
}

/** 目录内的 *.record.json，按文件名排序；.bak / .tmp 因后缀不同天然被排除 */
function findRecordFiles( userDir: string ): string[] {
	return readdirSync( userDir )
		.filter( name => name.endsWith( RECORD_SUFFIX ) )
		.sort();
}

/** 读取并校验 record.json：只要求是带 records 数组的对象 */
function parseRecordFile( filePath: string ): IRecord {
	let parsed: unknown;

	try {
		parsed = JSON.parse( readFileSync( filePath, 'utf-8' ) );
	} catch ( error ) {
		throw new SpellingEditorError( 'INTERNAL_ERROR', `录播数据文件读取失败: ${filePath}（${( error as Error ).message}）` );
	}

	if ( typeof parsed !== 'object' || parsed === null || !Array.isArray( ( parsed as IRecord ).records ) ) {
		throw new SpellingEditorError( 'INTERNAL_ERROR', `录播数据文件缺少 records 数组: ${filePath}` );
	}

	return parsed as IRecord;
}
