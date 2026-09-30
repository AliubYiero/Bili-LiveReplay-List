import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'node:path';
import { DataPathManager } from '../../utils/DataPathManager.ts';
import type { IRecord } from '../../interface/IRecord.ts';
import { acquireLock, persistJson, SpellingEditorError } from './editorCommon.ts';
import { parseAidRules, validateAidRules, type AidRules } from './recordsValidator.ts';

const RECORD_SUFFIX = '.record.json';
const AID_SUFFIX = '.aid.json';

/** 用户选择器的一项 */
export interface RecordUserSummary {
	uid: string;
	userName: string;
}

/**
 * 列出可用用户：同时存在 <uname>.record.json 与 <uname>.aid.json 的用户
 * 全程只读——扫描不能因为读一个不存在的用户就凭空建出空目录
 */
export function listUsers(): RecordUserSummary[] {
	const dataDir = DataPathManager.getDataDir();

	if ( !existsSync( dataDir ) ) {
		return [];
	}

	const users: RecordUserSummary[] = [];

	for ( const entry of readdirSync( dataDir, { withFileTypes: true } ) ) {
		// data/ 根下还有 SpellingCorrections.json 等文件，只认数字命名的用户目录
		if ( !entry.isDirectory() || !/^\d+$/.test( entry.name ) ) {
			continue;
		}

		for ( const userName of findPairedUserNames( join( dataDir, entry.name ) ) ) {
			users.push( { uid: entry.name, userName } );
		}
	}

	return users.sort( ( a, b ) => Number( a.uid ) - Number( b.uid ) );
}

/**
 * 读取指定用户的 record.json 与 aid.json
 * record.json 只用于展示，aid.json 是可编辑的数据源
 */
export function readUserRecords( uid: string, userName: string ): { record: IRecord; aid: AidRules } {
	const paths = DataPathManager.resolveUserFilePaths( uid, userName );

	if ( !existsSync( paths.recordPath ) ) {
		throw new SpellingEditorError( 'USER_NOT_FOUND', `找不到录播数据文件: ${paths.recordPath}` );
	}

	if ( !existsSync( paths.aidPath ) ) {
		throw new SpellingEditorError( 'AID_FILE_NOT_FOUND', `找不到映射文件: ${paths.aidPath}` );
	}

	return {
		record: parseRecordFile( paths.recordPath ),
		aid: parseAidFile( paths.aidPath )
	};
}

/**
 * 保存指定用户的 aid.json
 * 加锁 → 校验请求体 → 读取当前文件 → 合并 → 备份 → 原子写入 → 释放锁
 * 采用合并而非整体替换：保留编辑器加载后由主程序 AidMapperStore 补入的 key
 */
export async function saveAidRules( uid: string, userName: string, rules: AidRules ): Promise<void> {
	const paths = DataPathManager.resolveUserFilePaths( uid, userName );

	if ( !existsSync( paths.aidPath ) ) {
		throw new SpellingEditorError( 'AID_FILE_NOT_FOUND', `找不到映射文件: ${paths.aidPath}` );
	}

	// 校验放在加锁之前：非法请求不该占用文件锁
	const validationResult = validateAidRules( rules );
	if ( !validationResult.success ) {
		throw new SpellingEditorError( validationResult.error, validationResult.message );
	}

	const release = await acquireLock( paths.aidPath );

	try {
		const merged: AidRules = {
			...parseAidFile( paths.aidPath ),
			...validationResult.data
		};

		persistJson( paths.aidPath, merged );
	} finally {
		await release();
	}
}

/**
 * 目录内同时拥有 record.json 与 aid.json 的用户名
 * 备份 / 临时文件（.bak / .tmp）不匹配这两个后缀，天然被排除
 */
function findPairedUserNames( userDir: string ): string[] {
	const recordNames: string[] = [];
	const aidNames = new Set<string>();

	for ( const file of readdirSync( userDir ) ) {
		if ( file.endsWith( RECORD_SUFFIX ) ) {
			recordNames.push( file.slice( 0, -RECORD_SUFFIX.length ) );
		} else if ( file.endsWith( AID_SUFFIX ) ) {
			aidNames.add( file.slice( 0, -AID_SUFFIX.length ) );
		}
	}

	// 用数组收集而不是展开 Set：tsconfig 未设 target，迭代 Set 会触发 downlevelIteration 报错
	return recordNames.filter( name => aidNames.has( name ) ).sort();
}

/** 读取并校验 record.json：只要求是带 records 数组的对象 */
function parseRecordFile( filePath: string ): IRecord {
	const parsed = readJsonFile( filePath, '录播数据文件' );

	if ( !isPlainObject( parsed ) || !Array.isArray( ( parsed as IRecord ).records ) ) {
		throw new SpellingEditorError( 'INTERNAL_ERROR', `录播数据文件缺少 records 数组: ${filePath}` );
	}

	return parsed as IRecord;
}

/** 读取并校验 aid.json */
function parseAidFile( filePath: string ): AidRules {
	const result = parseAidRules( readJsonFile( filePath, '映射文件' ) );

	if ( !result.success ) {
		throw new SpellingEditorError(
			'INTERNAL_ERROR',
			`映射文件不符合 Record<string, string[]> 结构: ${result.message}`
		);
	}

	return result.data;
}

/** 读取并解析 JSON 文件，失败统一报 INTERNAL_ERROR */
function readJsonFile( filePath: string, label: string ): unknown {
	let raw: string;

	try {
		raw = readFileSync( filePath, 'utf-8' );
	} catch ( error ) {
		throw new SpellingEditorError( 'INTERNAL_ERROR', `${label}读取失败: ${( error as Error ).message}` );
	}

	try {
		return JSON.parse( raw );
	} catch ( error ) {
		throw new SpellingEditorError( 'INTERNAL_ERROR', `${label}不是合法 JSON: ${( error as Error ).message}` );
	}
}

/** 判断是否为普通对象（排除 null 与数组） */
function isPlainObject( value: unknown ): boolean {
	return typeof value === 'object' && value !== null && !Array.isArray( value );
}
