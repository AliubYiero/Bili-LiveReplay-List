import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, BrowserContext, Locator, Page, Response } from 'playwright';
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
 * 只携带上下文, 不拼日志前缀: 「[采集失败] 谁(uid)」由调用方统一拼一次,
 * 否则错误被重新包装时会叠出多层 `[采集失败]`。
 */
export class ScraperHealthError extends Error {
	constructor(
		public readonly uid: number,
		public readonly sourceType: VideoSourceType,
		message: string,
		/** 接口返回的业务错误码（如 `-352` 风控校验失败） */
		public readonly code?: number,
		/** 出错时请求的接口地址 */
		public readonly requestUrl?: string,
		/** 接口响应体原文（已截断） */
		public readonly responseBody?: string,
	) {
		super( message );
		this.name = 'ScraperHealthError';
	}
}

/**
 * 登录态失效 / 风控类错误码
 *
 * -101 账号未登录, -352 风控校验失败, -412 请求被拦截。
 * 采集层不原地重试（连续打同一接口只会加重风控）, 由 `runDailyUpdate`
 * 冷却后换一个新的 context 重试一次。
 */
const RISK_CONTROL_CODES = new Set( [ -101, -352, -412 ] );

export const isRiskControlError = ( error: unknown ): error is ScraperHealthError =>
	error instanceof ScraperHealthError
	&& error.code !== undefined
	&& RISK_CONTROL_CODES.has( error.code );

const errorMessage = ( error: unknown ) =>
	error instanceof Error ? error.message : String( error );

/** 日志里保留的响应体长度上限, 避免把整页 JSON 打进 CI 日志 */
const RESPONSE_BODY_LOG_LIMIT = 300;

const truncate = ( text: string, limit = RESPONSE_BODY_LOG_LIMIT ) =>
	text.length > limit ? `${ text.slice( 0, limit ) }…` : text;

/**
 * 打印登录态与 cookie 概况
 *
 * 用来区分「cookie 真的过期了」和「接口临时风控」: 前者 `isLogin=false`,
 * 后者往往 `isLogin=true` 但空间接口仍返回 -352。只打印 cookie 名字, 不打印值。
 */
const logLoginDiagnostics = async (
	context: BrowserContext,
	uid: number,
	sourceType: VideoSourceType,
): Promise<boolean | undefined> => {
	let isLogin: boolean | undefined;

	try {
		const navResponse = await context.request.get( SCRAPER_CONFIG.navApiUrl );
		const nav = await navResponse.json() as {
			code?: number;
			message?: string;
			data?: { isLogin?: boolean; mid?: number; uname?: string };
		};
		isLogin = nav?.data?.isLogin;

		console.error(
			`[采集诊断] uid=${ uid } source=${ sourceType } `
			+ `nav: code=${ nav?.code } isLogin=${ isLogin } mid=${ nav?.data?.mid }`
			+ ( nav?.data?.uname ? ` uname=${ nav.data.uname }` : '' ),
		);
	}
	catch ( error ) {
		console.error( `[采集诊断] 读取 nav 失败: ${ errorMessage( error ) }` );
	}

	try {
		const names = ( await context.cookies() )
			.map( cookie => cookie.name )
			.sort();

		console.error(
			`[采集诊断] context 内 cookie (${ names.length }): ${ names.join( ', ' ) }`,
		);
	}
	catch ( error ) {
		console.error( `[采集诊断] 读取 cookie 失败: ${ errorMessage( error ) }` );
	}

	return isLogin;
};

/**
 * 风控类失败时打印可复现的上下文
 *
 * 请求地址 + 响应体 + 登录态一起看, 才能判断是 cookie 过期还是接口级风控。
 */
const logRiskControlDiagnostics = async (
	context: BrowserContext,
	error: ScraperHealthError,
): Promise<boolean | undefined> => {
	if ( error.requestUrl ) {
		console.error( `[采集诊断] 失败请求: ${ error.requestUrl }` );
	}
	if ( error.responseBody ) {
		console.error( `[采集诊断] 响应体: ${ error.responseBody }` );
	}

	return logLoginDiagnostics( context, error.uid, error.sourceType );
};

/**
 * 把登录态一并写进错误文案: `isLogin=false` 时直接点明 cookie 已失效
 */
const describeRiskControlFailure = (
	isLogin: boolean | undefined,
	error: ScraperHealthError,
) => {
	if ( isLogin === false ) {
		return 'BILI_COOKIE 已失效（nav 接口返回未登录）, '
			+ '请重新获取 BILI_COOKIE（DevTools → Application → Cookies, SESSDATA 是 HttpOnly 项）';
	}

	return `登录态失效或被风控（${ errorMessage( error ) }）, `
		+ '请重新获取 BILI_COOKIE（DevTools → Application → Cookies, SESSDATA 是 HttpOnly 项）';
};

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
 *
 * 直接读取 `Response` 而不是调用方先 `json()`, 这样业务错误码能带上
 * 请求地址与响应体原文, CI 日志里才能看出到底是风控还是别的业务错误。
 */
const readPage = async (
	uid: number,
	sourceType: VideoSourceType,
	response: Response,
): Promise<NormalizedPage> => {
	const requestUrl = response.url();

	let body: string;
	try {
		body = await response.text();
	}
	catch ( error ) {
		throw new ScraperHealthError(
			uid,
			sourceType,
			`读取接口响应失败: ${ errorMessage( error ) }`,
			undefined,
			requestUrl,
		);
	}

	let payload: unknown;
	try {
		payload = JSON.parse( body );
	}
	catch {
		throw new ScraperHealthError(
			uid,
			sourceType,
			'接口响应不是合法 JSON',
			undefined,
			requestUrl,
			truncate( body ),
		);
	}

	const result = payload as { code?: number; message?: string };

	if ( result?.code !== 0 ) {
		throw new ScraperHealthError(
			uid,
			sourceType,
			`接口返回错误码 ${ result?.code }: ${ result?.message ?? '未知错误' }`,
			result?.code,
			requestUrl,
			truncate( body ),
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
			undefined,
			requestUrl,
			truncate( body ),
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

	return readPage( uid, sourceType, await responsePromise );
};

/**
 * 采集前先访问一次首页, 让 B 站把 buvid3 / buvid4 等风控 cookie 补齐
 *
 * 只注入 SESSDATA / bili_jct / DedeUserID 时, 空间页容易被判定为 `-352 风控校验失败`。
 * 预热失败只告警, 不阻塞采集。
 */
const warmUp = async ( page: Page ) => {
	try {
		await page.goto( SCRAPER_CONFIG.warmupUrl, {
			waitUntil: 'domcontentloaded',
			timeout: SCRAPER_CONFIG.warmupTimeoutMs,
		} );
	}
	catch ( error ) {
		console.warn(
			`访问 ${ SCRAPER_CONFIG.warmupUrl } 预热失败, 继续采集: ${ errorMessage( error ) }`,
		);
	}
};

/**
 * 打开目标页面并读回第一页
 *
 * 导航失败时按 `navigationBackoffMs` 退避重试整个流程; 风控 / 登录态类错误
 * 不重试, 直接失败。
 */
const openFirstPage = async (
	context: BrowserContext,
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
			const normalized = await readPage( uid, sourceType, response );
			await assertPaginationRendered( page, uid, sourceType, normalized );
			return normalized;
		}
		catch ( error ) {
			lastError = error;

			// 风控 / 登录态失效: 重试只会加重风控, 立刻停止
			if ( isRiskControlError( error ) ) break;
		}
	}

	await captureDebugScreenshot( page, uid, sourceType );

	if ( isRiskControlError( lastError ) ) {
		const isLogin = await logRiskControlDiagnostics( context, lastError );
		throw new ScraperHealthError(
			uid,
			sourceType,
			describeRiskControlFailure( isLogin, lastError ),
			lastError.code,
			lastError.requestUrl,
			lastError.responseBody,
		);
	}

	throw new ScraperHealthError(
		uid,
		sourceType,
		`打开页面失败, 已重试 ${ SCRAPER_CONFIG.navigationRetryLimit } 次: ${ errorMessage( lastError ) }`,
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
		// upload 依赖登录态, 先访问首页拿 buvid; replay 匿名可用, 跳过省时间
		if ( sourceType === 'upload' ) await warmUp( page );

		const targetUrl = sourceConfig.buildTargetUrl( uid, seriesId );
		let currentPage = await openFirstPage( context, page, uid, sourceType, targetUrl );

		const logProgress = () => {
			const maxPage = calcMaxPage( currentPage.total, currentPage.pageSize );
			console.info(
				`正在读取用户 ${ uid } 的${ sourceConfig.label }...(Page ${ currentPage.currentPage } / ${ maxPage })`,
			);
		};

		logProgress();
		yield currentPage;

		let retryCount = 0;
		while ( !shouldStopPaging( currentPage ) ) {
			const previousPageNumber = currentPage.currentPage;
			const nextPageNumber = previousPageNumber + 1;

			try {
				currentPage = await gotoPage( page, uid, sourceType, nextPageNumber );
				retryCount = 0;
			}
			catch ( error ) {
				// 翻页时也可能触发风控, 同样不原地重试
				if ( isRiskControlError( error ) ) {
					await captureDebugScreenshot( page, uid, sourceType );
					const isLogin = await logRiskControlDiagnostics( context, error );
					throw new ScraperHealthError(
						uid,
						sourceType,
						`第 ${ nextPageNumber } 页采集失败: ${ describeRiskControlFailure( isLogin, error ) }`,
						error.code,
						error.requestUrl,
						error.responseBody,
					);
				}

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
	}
	finally {
		await context.close();
	}
}
