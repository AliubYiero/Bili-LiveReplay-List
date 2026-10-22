import { BrowserContext } from 'playwright';

/** 存放登录 cookie 的环境变量名 */
export const BILIBILI_COOKIE_ENV = 'BILI_COOKIE';

type BilibiliCookie = Parameters<BrowserContext['addCookies']>[ 0 ][ number ];

const COOKIE_DOMAIN = '.bilibili.com';

/**
 * 解析 `BILI_COOKIE` 环境变量
 *
 * 形如 `SESSDATA=xxx; bili_jct=yyy; DedeUserID=zzz`（浏览器 DevTools 里
 * `document.cookie` 的原样拷贝即可）。没有等号的片段会被忽略。
 */
export const parseBilibiliCookie = (
	raw: string | undefined = process.env[ BILIBILI_COOKIE_ENV ],
): BilibiliCookie[] => {
	if ( !raw?.trim() ) return [];

	return raw
		.split( ';' )
		.map( segment => segment.trim() )
		.filter( Boolean )
		.flatMap( segment => {
			const separatorIndex = segment.indexOf( '=' );
			// cookie 名字不能为空，值里允许出现 '='
			if ( separatorIndex <= 0 ) return [];

			return [ {
				name: segment.slice( 0, separatorIndex ).trim(),
				value: segment.slice( separatorIndex + 1 ).trim(),
				domain: COOKIE_DOMAIN,
				path: '/',
			} ];
		} );
};

/**
 * 是否配置了登录态
 */
export const hasBilibiliCookie = (): boolean => parseBilibiliCookie().length > 0;

/**
 * 把登录态注入 context
 *
 * 必须在第一次导航之前调用。返回是否真的注入了 cookie。
 */
export const applyBilibiliCookie = async (
	context: BrowserContext,
): Promise<boolean> => {
	const cookies = parseBilibiliCookie();
	if ( cookies.length === 0 ) return false;

	await context.addCookies( cookies );
	return true;
};

/**
 * 启动时校验登录态
 *
 * 未登录状态下 B 站不返回空间主页投稿列表（接口返回 `-352 风控校验失败`，
 * 页面显示「空间主人还没投过视频」），所以只要有一个 UID 用 `upload` 就必须有登录态。
 * 直播回放（合集/系列）匿名可用，不强制要求。
 *
 * 另外会检查登录态是否「看起来完整」：`SESSDATA` 是 HttpOnly，`document.cookie`
 * 读不到它，所以从控制台拷出来的 cookie 串常常是残缺的；缺 `buvid3` 则由采集层
 * 访问首页预热补齐，这里只提示。
 */
export const assertBilibiliCookie = ( required: boolean ) => {
	if ( !required ) return;

	const cookies = parseBilibiliCookie();

	if ( cookies.length === 0 ) {
		throw new Error(
			'配置错误: 存在使用 upload 数据源的 UID, 但未配置登录态。'
			+ '未登录时 B 站不返回空间主页投稿列表（接口返回 -352 风控校验失败）。'
			+ `请在环境变量 ${ BILIBILI_COOKIE_ENV } 中配置登录 cookie, `
			+ '形如 "SESSDATA=xxx; bili_jct=yyy; DedeUserID=zzz"。',
		);
	}

	const names = new Set( cookies.map( cookie => cookie.name ) );

	if ( !names.has( 'SESSDATA' ) ) {
		console.warn(
			`警告: ${ BILIBILI_COOKIE_ENV } 中没有 SESSDATA, 登录态无效（大概率会返回 -352）。`
			+ 'SESSDATA 是 HttpOnly cookie, document.cookie 读不到, '
			+ '请从 DevTools → Application → Cookies → https://www.bilibili.com 复制。',
		);
	}

	if ( !names.has( 'buvid3' ) ) {
		console.warn(
			`提示: ${ BILIBILI_COOKIE_ENV } 中没有 buvid3, 采集前会先访问 B 站首页补齐风控 cookie。`,
		);
	}
};
