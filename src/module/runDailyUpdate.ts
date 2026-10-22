import { Browser } from 'playwright';
import { sleep } from 'radash';
import { SCRAPER_CONFIG } from '../config/scraper.config.ts';
import { isRiskControlError } from '../scraper/playwrightStreamPages.ts';
import { AidMapperStore } from '../store/AidMapperStore.ts';
import { RecordStore } from '../store/RecordStore.ts';
import { generateMarkdownRecord } from './generateReadme/generateMarkdownRecord.ts';
import { IParseItem } from './matchData/handleParseMapper.ts';
import { matchVideoList } from './matchData/matchVideoList.ts';

/** 失败发生在哪个环节 */
export type UploaderFailureStage = 'collect' | 'generate';

/** 单个上传者的失败记录 */
export interface UploaderFailure {
	uid: number;
	userName: string;
	stage: UploaderFailureStage;
	error: unknown;
}

/** 一轮更新的结果 */
export interface DailyUpdateResult {
	/** 本轮需要处理的上传者数量 */
	total: number;
	/** 失败环节列表, 为空表示全部成功 */
	failures: UploaderFailure[];
}

/** 一轮更新的可调参数 */
export interface RunDailyUpdateOptions {
	/** 相邻上传者之间的间隔（毫秒）, 降低触发 B 站风控的概率 */
	intervalMs?: number;
	/** 风控类采集失败的重试次数 */
	riskControlRetryLimit?: number;
	/** 风控重试前的冷却时间（毫秒） */
	riskControlBackoffMs?: number;
}

const STAGE_LABEL: Record<UploaderFailureStage, string> = {
	collect: '采集',
	generate: '生成文档',
};

const errorMessage = ( error: unknown ) => {
	if ( error instanceof Error ) return error.message;
	return String( error );
};

/**
 * 拼出可直接打印的失败汇总
 *
 * 既用于本地日志, 也用于 CI 的 step summary, 因此保持纯函数。
 */
export const formatFailureSummary = ( failures: UploaderFailure[] ): string => {
	const lines = failures.map(
		( { uid, userName, stage, error } ) =>
			`  - ${ userName }(uid:${ uid }) [${ STAGE_LABEL[ stage ] }]: ${ errorMessage( error ) }`,
	);

	return [ `本次运行有 ${ failures.length } 个环节失败:`, ...lines ].join( '\n' );
};

/**
 * 这轮更新是否应该以失败退出
 *
 * 单个上传者被采集层风控（-352 等）只算「本次没更新」, 不应让整次 CI 变红:
 * 旧数据仍在, 产物照常生成部署, 下次运行会继续尝试。
 * 文档生成失败说明磁盘数据或写入出了问题, 才算硬失败。
 */
export const shouldFailRun = ( failures: UploaderFailure[] ): boolean =>
	failures.some( failure => failure.stage === 'generate' );

/**
 * 采集单个上传者
 *
 * 每次调用都会新建 context 并重新预热, 因此风控重试天然等价于「换一个新会话」。
 */
const collectUploader = async ( item: IParseItem, browser: Browser ) => {
	const { uid, userName, videoSourceType, seriesId, onParse } = item;
	await matchVideoList( uid, userName, videoSourceType, seriesId, onParse, browser );
};

/**
 * 执行一轮「采集 + 生成文档」
 *
 * 单个上传者失败**不会**中断整轮: 采集失败只影响该上传者的增量, 其余照常;
 * 文档生成在采集之后独立跑一遍, 数据源是磁盘上的 `record.json`,
 * 因此即使采集全挂, 也能生成与上次一致的文档与 web 数据。
 *
 * 风控类错误（`-352` 等）多数是瞬时的: 冷却一段时间后换新 context 再试,
 * 比直接放弃这个上传者一整天更划算。
 *
 * @param items 解析器配置与实现组装后的列表
 * @param browser 全局复用的浏览器实例
 * @param options 间隔与风控重试参数, 默认取 `SCRAPER_CONFIG`
 */
export const runDailyUpdate = async (
	items: IParseItem[],
	browser: Browser,
	options: RunDailyUpdateOptions = {},
): Promise<DailyUpdateResult> => {
	const {
		intervalMs = SCRAPER_CONFIG.uploaderIntervalMs,
		riskControlRetryLimit = SCRAPER_CONFIG.riskControlRetryLimit,
		riskControlBackoffMs = SCRAPER_CONFIG.riskControlBackoffMs[
			SCRAPER_CONFIG.riskControlBackoffMs.length - 1
		] ?? 0,
	} = options;

	const failures: UploaderFailure[] = [];

	// 第一趟: 采集增量
	for ( let index = 0; index < items.length; index++ ) {
		if ( index > 0 && intervalMs > 0 ) await sleep( intervalMs );

		const { uid, userName, videoSourceType } = items[ index ];

		try {
			await collectUploader( items[ index ], browser );
		}
		catch ( error ) {
			console.error(
				`[采集失败] ${ userName }(uid:${ uid }) [${ videoSourceType }]: ${ errorMessage( error ) }`,
			);
			console.error( '已跳过该上传者, 继续处理后续上传者' );
			failures.push( { uid, userName, stage: 'collect', error } );
		}
	}

	// 风控重试: 只重试「因为风控 / 登录态而失败」的采集项
	let riskRetryQueue = failures
		.filter( failure => failure.stage === 'collect' && isRiskControlError( failure.error ) )
		.map( failure => failure.uid );

	for ( let attempt = 1; attempt <= riskControlRetryLimit && riskRetryQueue.length > 0; attempt++ ) {
		if ( riskControlBackoffMs > 0 ) {
			console.warn(
				`有 ${ riskRetryQueue.length } 个上传者被风控, `
				+ `${ Math.round( riskControlBackoffMs / 1000 ) }s 后换新会话重试 `
				+ `（第 ${ attempt } / ${ riskControlRetryLimit } 次）`,
			);
			await sleep( riskControlBackoffMs );
		}

		const recovered = new Set<number>();

		for ( let index = 0; index < riskRetryQueue.length; index++ ) {
			if ( index > 0 && intervalMs > 0 ) await sleep( intervalMs );

			const uid = riskRetryQueue[ index ];
			const item = items.find( candidate => candidate.uid === uid );
			if ( !item ) continue;

			try {
				await collectUploader( item, browser );
				recovered.add( uid );
				console.info(
					`[风控重试成功] ${ item.userName }(uid:${ uid })（第 ${ attempt } 次重试）`,
				);
			}
			catch ( error ) {
				console.error(
					`[风控重试失败] ${ item.userName }(uid:${ uid }) `
					+ `（第 ${ attempt } 次重试）: ${ errorMessage( error ) }`,
				);

				const failure = failures.find(
					candidate => candidate.uid === uid && candidate.stage === 'collect',
				);
				if ( failure ) failure.error = error;
			}
		}

		for ( let index = failures.length - 1; index >= 0; index-- ) {
			const failure = failures[ index ];
			if ( failure.stage === 'collect' && recovered.has( failure.uid ) ) {
				failures.splice( index, 1 );
			}
		}

		// 以最新错误为准重建队列: 已恢复的、重试后变成非风控错误的都不再重试
		riskRetryQueue = failures
			.filter( failure => failure.stage === 'collect' && isRiskControlError( failure.error ) )
			.map( failure => failure.uid );
	}

	// 第二趟: 生成 markdown 与 aid 映射, 始终以磁盘数据为准
	for ( const { uid, userName } of items ) {
		try {
			const configStore = new RecordStore( uid, userName );
			generateMarkdownRecord( uid, userName, configStore );
			const aidList = configStore.recordList.map( record => String( record.aid ) );
			new AidMapperStore( uid, userName ).update( aidList );
		}
		catch ( error ) {
			console.error( `[生成文档失败] ${ userName }(uid:${ uid }): ${ errorMessage( error ) }` );
			failures.push( { uid, userName, stage: 'generate', error } );
		}
	}

	return { total: items.length, failures };
};
