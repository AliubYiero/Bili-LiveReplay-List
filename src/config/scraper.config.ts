import { VideoSourceType } from '../interface/IRecord.ts';

export interface ScraperSourceConfig {
	/** 日志里展示的数据源名称 */
	label: string;
	/** 数据源对应的页面地址 */
	buildTargetUrl: ( uid: number, seriesId?: number ) => string;
	/** 需要在页面里拦截的接口路径片段 */
	endpoint: string;
	/** 接口的分页参数名 */
	pageParam: string;
}

const sources: Record<VideoSourceType, ScraperSourceConfig> = {
	upload: {
		label: '主页视频',
		buildTargetUrl: uid => `https://space.bilibili.com/${ uid }/upload/video`,
		endpoint: '/x/space/wbi/arc/search',
		pageParam: 'pn',
	},
	replay: {
		label: '直播回放',
		buildTargetUrl: ( uid, seriesId ) => `https://space.bilibili.com/${ uid }/lists/${ seriesId }?type=series`,
		endpoint: '/x/series/archives',
		pageParam: 'pn',
	},
};

/**
 * Playwright 采集层的全部可调参数
 *
 * 页面改版时优先改这里的选择器, 不要改采集器的控制流。
 */
export const SCRAPER_CONFIG = {
	/** 跳页失败时重试当前页的次数 */
	pageRetryLimit: 3,
	/** 首个页面导航失败时重试整个流程的次数 */
	navigationRetryLimit: 3,
	/** 导航重试的退避时间（毫秒）, 超出长度后取最后一个 */
	navigationBackoffMs: [ 20_000, 40_000, 80_000 ],
	/** 跳页重试的间隔基数（毫秒）, 第 n 次重试等待 n 倍 */
	pageRetryDelayMs: 3_000,
	/** 等待接口响应的超时（毫秒） */
	responseTimeoutMs: 30_000,
	/** 页面导航超时（毫秒） */
	navigationTimeoutMs: 60_000,
	/** 元素等待超时（毫秒） */
	selectorTimeoutMs: 15_000,
	/** 探测分页器、跳页输入框时的短超时（毫秒） */
	probeTimeoutMs: 5_000,
	/** 点击跳页触发器后等待界面展开（毫秒） */
	pageSettleMs: 800,
	/** 采集失败时保存截图的目录 */
	debugDir: 'debug',
	userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	viewport: { width: 1440, height: 900 },
	locale: 'zh-CN',
	timezoneId: 'Asia/Shanghai',
	sources,
	selectors: {
		/** 分页器容器, 用于确认页面确实渲染出了翻页控件 */
		pagination: [
			'.vui_pagenation',
			'.be-pagination',
			'[class*="pagination"]',
			'[class*="pagenation"]',
		],
		/**
		 * 让跳页输入框出现的触发器, 存在时才点击
		 *
		 * 只保留分页器内部的候选, 避免误点到页面上其它带 `jump` 字样的元素。
		 */
		jumpPageTrigger: [
			'.vui_pagenation--jump',
			'.be-pagination__jump',
			'[class*="pagination"] [class*="jump"]',
			'[class*="pagenation"] [class*="jump"]',
		],
		/** 跳页输入框 */
		jumpPageInput: [
			'input[aria-label="输入要跳转的页码"]',
			'.vui_pagenation--input input',
			'.be-pagination input[type="text"]',
			'[class*="pagination"] input[type="text"]',
			'[class*="pagenation"] input[type="text"]',
		],
	},
};
