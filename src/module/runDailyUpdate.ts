import { Browser } from 'playwright';
import { sleep } from 'radash';
import { SCRAPER_CONFIG } from '../config/scraper.config.ts';
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
 * 执行一轮「采集 + 生成文档」
 *
 * 单个上传者失败**不会**中断整轮: 采集失败只影响该上传者的增量, 其余照常;
 * 文档生成在采集之后独立跑一遍, 数据源是磁盘上的 `record.json`,
 * 因此即使采集全挂, 也能生成与上次一致的文档与 web 数据。
 *
 * @param items 解析器配置与实现组装后的列表
 * @param browser 全局复用的浏览器实例
 * @param intervalMs 相邻上传者之间的间隔, 降低触发 B 站风控的概率
 */
export const runDailyUpdate = async (
	items: IParseItem[],
	browser: Browser,
	intervalMs: number = SCRAPER_CONFIG.uploaderIntervalMs,
): Promise<DailyUpdateResult> => {
	const failures: UploaderFailure[] = [];

	// 第一趟: 采集增量
	for ( let index = 0; index < items.length; index++ ) {
		if ( index > 0 && intervalMs > 0 ) await sleep( intervalMs );

		const { uid, userName, videoSourceType, seriesId, onParse } = items[ index ];

		try {
			await matchVideoList( uid, userName, videoSourceType, seriesId, onParse, browser );
		}
		catch ( error ) {
			console.error( `[采集失败] ${ userName }(uid:${ uid }): ${ errorMessage( error ) }` );
			console.error( '已跳过该上传者, 继续处理后续上传者' );
			failures.push( { uid, userName, stage: 'collect', error } );
		}
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
