import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, Locator, Page } from 'playwright';
import { sleep } from 'radash';
import { SCRAPER_CONFIG } from '../config/scraper.config.ts';
import { VideoSourceType } from '../interface/IRecord.ts';
import { applyBilibiliCookie } from './bilibiliCookie.ts';
import {
	NormalizedPage,
	normalizeReplayResponse,
	normalizeUploadResponse,
} from './normalize.ts';
import { calcMaxPage, shouldStopPaging } from './paging.ts';

/**
 * 采集层抛出的明确错误
 *
 * 带上 uid 与数据源类型, 便于在日志里直接定位是哪个主播的哪个数据源出了问题。
 */
export class ScraperHealthError extends Error {
	constructor(
		public readonly uid: number,
		public readonly sourceType: VideoSourceType,
		message: string,
	) {
		super( `[采集失败] uid=${ uid } source=${ sourceType }: ${ message }` );
		this.name = 'ScraperHealthError';
	}
}

/**
 * 采集失败时保存截图, 方便排查页面改版
 */
const captureDebugScreenshot = async (
	page: Page,
	uid: number,
	sourceType: VideoSourceType,
) => {
	try {
		mkdirSync( SCRAPER_CONFIG.debugDir, { recursive: true } );
		const filename = `${ uid }-${ sourceType }-${ Date.now() }.png`;
		const filePath = join( SCRAPER_CONFIG.debugDir, filename );
		await page.screenshot( { path: filePath, fullPage: true } );
		console.error( `已保存失败截图: ${ filePath }` );
	}
	catch ( error ) {
		console.error( '保存失败截图时出错', error );
	}
};

/**
 * 等待指定页码的接口响应
 */
const waitForArchivesResponse = (
	page: Page,
	sourceType: VideoSourceType,
	expectedPage: number,
) => {
	const { endpoint, pageParam } = SCRAPER_CONFIG.sources[ sourceType ];

	return page.waitForResponse( response => {
		if ( !response.url().includes( endpoint ) ) return false;

		try {
			const pageNumber = new URL( response.url() ).searchParams.get( pageParam );
			// 部分场景下第一页不会带上分页参数
			if ( pageNumber === null ) return expectedPage === 1;
			return Number( pageNumber ) === expectedPage;
		}
		catch {
			return false;
		}
	}, { timeout: SCRAPER_CONFIG.responseTimeoutMs } );
};

/**
 * 校验接口响应并归一化
 */
const readPage = (
	uid: number,
	sourceType: VideoSourceType,
	payload: unknown,
): NormalizedPage => {
	const response = payload as { code?: number; message?: string };

	if ( response?.code !== 0 ) {
		throw new ScraperHealthError(
			uid,
			sourceType,
			`接口返回错误码 ${ response?.code }: ${ response?.message ?? '未知错误' }`,
		);
	}

	const normalized = sourceType === 'upload'
		? normalizeUploadResponse( payload as Parameters<typeof normalizeUploadResponse>[ 0 ] )
		: normalizeReplayResponse( payload as Parameters<typeof normalizeReplayResponse>[ 0 ] );

	// 声明有数据却一条都没解析出来, 说明响应结构变了
	if ( normalized.archives.length === 0 && normalized.total > 0 ) {
		throw new ScraperHealthError(
			uid,
			sourceType,
			`接口声明共有 ${ normalized.total } 条数据, 但第 ${ normalized.currentPage } 页解析结果为空, 响应结构可能已改版`,
		);
	}

	return normalized;
};

/**
 * 确认页面确实渲染出了分页器
 *
 * 只有一页时页面上本来就没有分页器, 这种情况跳过检查。
 */
const assertPaginationRendered = async (
	page: Page,
	uid: number,
	sourceType: VideoSourceType,
	normalized: NormalizedPage,
) => {
	if ( calcMaxPage( normalized.total, normalized.pageSize ) <= 1 ) return;

	for ( const selector of SCRAPER_CONFIG.selectors.pagination ) {
		try {
			await page.waitForSelector( selector, {
				state: 'attached',
				timeout: SCRAPER_CONFIG.probeTimeoutMs,
			} );
			return;
		}
		catch {
			// 换下一个选择器继续尝试
		}
	}

	await captureDebugScreenshot( page, uid, sourceType );
	throw new ScraperHealthError(
		uid,
		sourceType,
		`未找到分页器, 页面结构可能已改版（尝试过的选择器: ${ SCRAPER_CONFIG.selectors.pagination.join( ', ' ) }）`,
	);
};

/**
 * 定位跳页输入框, 必要时先点开跳页控件
 */
const findJumpPageInput = async ( page: Page ): Promise<Locator | null> => {
	const findVisibleInput = async () => {
		for ( const selector of SCRAPER_CONFIG.selectors.jumpPageInput ) {
			const input = page.locator( selector ).first();
			if ( await input.count() === 0 ) continue;

			try {
				await input.waitFor( { state: 'visible', timeout: SCRAPER_CONFIG.probeTimeoutMs } );
				return input;
			}
			catch {
				// 该选择器命中但不可见, 换下一个
			}
		}
		return null;
	};

	const visibleInput = await findVisibleInput();
	if ( visibleInput ) return visibleInput;

	// 输入框可能需要先点开跳页控件才会出现
	for ( const selector of SCRAPER_CONFIG.selectors.jumpPageTrigger ) {
		const trigger = page.locator( selector ).first();
		if ( await trigger.count() === 0 ) continue;

		await trigger.click().catch( () => undefined );
		await page.waitForTimeout( SCRAPER_CONFIG.pageSettleMs );

		const input = await findVisibleInput();
		if ( input ) return input;
	}

	return null;
};

/**
 * 通过输入框跳到指定页
 */
const jumpToPage = async (
	page: Page,
	uid: number,
	sourceType: VideoSourceType,
	pageNumber: number,
) => {
	const input = await findJumpPageInput( page );
	if ( !input ) {
		await captureDebugScreenshot( page, uid, sourceType );
		throw new ScraperHealthError(
			uid,
			sourceType,
			`未找到跳页输入框, 页面结构可能已改版（尝试过的选择器: ${ SCRAPER_CONFIG.selectors.jumpPageInput.join( ', ' ) }）`,
		);
	}

	await input.fill( String( pageNumber ) );
	await input.press( 'Enter' );
};

/**
 * 翻到指定页并读回归一化数据
 */
const gotoPage = async (
	page: Page,
	uid: number,
	sourceType: VideoSourceType,
	pageNumber: number,
): Promise<NormalizedPage> => {
	const responsePromise = waitForArchivesResponse( page, sourceType, pageNumber );
	// 跳页本身失败时这个 promise 会一直挂着, 先挂一个 catch 防止未处理的 rejection
	responsePromise.catch( () => undefined );

	await jumpToPage( page, uid, sourceType, pageNumber );

	const response = await responsePromise;
	return readPage( uid, sourceType, await response.json() );
};

/**
 * 打开目标页面并读回第一页
 *
 * 导航失败时按 `navigationBackoffMs` 退避重试整个流程。
 */
const openFirstPage = async (
	page: Page,
	uid: number,
	sourceType: VideoSourceType,
	targetUrl: string,
): Promise<NormalizedPage> => {
	let lastError: unknown;

	for ( let attempt = 0; attempt <= SCRAPER_CONFIG.navigationRetryLimit; attempt++ ) {
		if ( attempt > 0 ) {
			const backoffList = SCRAPER_CONFIG.navigationBackoffMs;
			const backoff = backoffList[ Math.min( attempt - 1, backoffList.length - 1 ) ];
			console.warn(
				`用户 ${ uid } 的${ SCRAPER_CONFIG.sources[ sourceType ].label }页面导航失败, `
				+ `${ Math.round( backoff / 1000 ) }s 后重试（第 ${ attempt } 次）`,
			);
			await sleep( backoff );
		}

		try {
			const responsePromise = waitForArchivesResponse( page, sourceType, 1 );
			responsePromise.catch( () => undefined );

			await page.goto( targetUrl, {
				waitUntil: 'domcontentloaded',
				timeout: SCRAPER_CONFIG.navigationTimeoutMs,
			} );

			const response = await responsePromise;
			const normalized = readPage( uid, sourceType, await response.json() );
			await assertPaginationRendered( page, uid, sourceType, normalized );
			return normalized;
		}
		catch ( error ) {
			lastError = error;
		}
	}

	await captureDebugScreenshot( page, uid, sourceType );
	throw new ScraperHealthError(
		uid,
		sourceType,
		`打开页面失败, 已重试 ${ SCRAPER_CONFIG.navigationRetryLimit } 次: ${ ( lastError as Error )?.message }`,
	);
};

/**
 * 采集单个数据源的视频列表, 逐页产出归一化数据
 *
 * 调用方通过 `for await` 消费；提前 `return` / `break` 时生成器的 `finally`
 * 仍会关闭 context。
 *
 * @param browser 全局复用的浏览器实例
 * @param uid 上传者 UID
 * @param sourceType 数据源类型
 * @param seriesId 直播回放合集 ID, `replay` 时必需
 */
export async function* playwrightStreamPages(
	browser: Browser,
	uid: number,
	sourceType: VideoSourceType,
	seriesId?: number,
): AsyncGenerator<NormalizedPage> {
	const sourceConfig = SCRAPER_CONFIG.sources[ sourceType ];

	if ( sourceType === 'replay' && !seriesId ) {
		throw new ScraperHealthError( uid, sourceType, '直播回放数据源缺少 seriesId 配置' );
	}

	const context = await browser.newContext( {
		userAgent: SCRAPER_CONFIG.userAgent,
		viewport: SCRAPER_CONFIG.viewport,
		locale: SCRAPER_CONFIG.locale,
		timezoneId: SCRAPER_CONFIG.timezoneId,
	} );
	// 必须在第一次导航之前注入登录态；没配置时静默跳过（直播回放匿名可用）
	await applyBilibiliCookie( context );

	const page = await context.newPage();
	page.setDefaultTimeout( SCRAPER_CONFIG.selectorTimeoutMs );

	try {
		const targetUrl = sourceConfig.buildTargetUrl( uid, seriesId );
		let currentPage = await openFirstPage( page, uid, sourceType, targetUrl );

		const logProgress = () => {
			const maxPage = calcMaxPage( currentPage.total, currentPage.pageSize );
			console.info(
				`正在读取用户 ${ uid } 的${ sourceConfig.label }...(Page ${ currentPage.currentPage } / ${ maxPage })`,
			);
		};

		logProgress();
		yield currentPage;

		let retryCount = 0;
		while ( !shouldStopPaging( currentPage, SCRAPER_CONFIG.limitPages ) ) {
			const previousPageNumber = currentPage.currentPage;
			const nextPageNumber = previousPageNumber + 1;

			try {
				currentPage = await gotoPage( page, uid, sourceType, nextPageNumber );
				retryCount = 0;
			}
			catch ( error ) {
				retryCount++;
				if ( retryCount > SCRAPER_CONFIG.pageRetryLimit ) {
					await captureDebugScreenshot( page, uid, sourceType );
					throw new ScraperHealthError(
						uid,
						sourceType,
						`跳转到第 ${ nextPageNumber } 页失败, 已重试 ${ SCRAPER_CONFIG.pageRetryLimit } 次: ${ ( error as Error )?.message }`,
					);
				}

				console.warn(
					`用户 ${ uid } 的${ sourceConfig.label }第 ${ nextPageNumber } 页读取失败, `
					+ `第 ${ retryCount } 次重试: ${ ( error as Error )?.message }`,
				);
				await sleep( SCRAPER_CONFIG.pageRetryDelayMs * retryCount );
				continue;
			}

			// 页码没有推进说明接口的分页字段变了, 继续下去只会反复抓同一页
			if ( currentPage.currentPage <= previousPageNumber ) {
				await captureDebugScreenshot( page, uid, sourceType );
				throw new ScraperHealthError(
					uid,
					sourceType,
					`请求第 ${ nextPageNumber } 页, 但响应里的页码仍是 ${ currentPage.currentPage }, `
					+ '接口的分页字段可能已改版, 已停止采集以避免重复抓取',
				);
			}

			logProgress();
			yield currentPage;
		}

		const maxPage = calcMaxPage( currentPage.total, currentPage.pageSize );
		if ( currentPage.currentPage >= SCRAPER_CONFIG.limitPages
			&& currentPage.currentPage < maxPage ) {
			console.warn(
				`用户 ${ uid } 的${ sourceConfig.label }页数超过最大限制 ${ SCRAPER_CONFIG.limitPages }, 已停止获取`,
			);
		}
	}
	finally {
		await context.close();
	}
}
