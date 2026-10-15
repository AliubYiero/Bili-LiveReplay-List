import { ILiverEntry } from '../../config/parseMapper.config.ts';

/**
 * 从标题中提取直播日期
 * @param title - 需要解析的标题字符串
 * @param fallbackDate - 备用日期（当标题无有效日期时使用）
 * @returns 有效的直播时间戳（毫秒）
 */
export function extractLiveDate( title: string, fallbackDate: number ): number {
	// 优先尝试匹配中文日期格式（YYYY年MM月DD日）
	const cnDateMatch = title.match( /(\d{2,4})年(\d{1,2})月(\d{1,2})日/ );
	if ( cnDateMatch ) {
		const [ , rawYear, month, day ] = cnDateMatch;
		const year = rawYear.length === 2 ? `20${ rawYear }` : rawYear;
		return new Date(
			Number( year ),
			Number( month ) - 1, // 月份从0开始
			Number( day ),
		).getTime();
	}
	
	// 尝试匹配ISO日期格式（YYYY-MM-DD）
	const isoDateMatch = title.match( /(\d{2,4})-(\d{1,2})-(\d{1,2})/ );
	if ( isoDateMatch ) {
		const [ , rawYear, month, day ] = isoDateMatch;
		// 处理两位年份（如23 -> 2023）
		const year = rawYear.length === 2 ? `20${ rawYear }` : rawYear;
		return new Date(
			Number( year ),
			Number( month ) - 1,
			Number( day ),
		).getTime();
	}
	
	// 使用备用日期（发布日期）
	return new Date( fallbackDate ).getTime();
}

/**
 * 从标题中提取直播主播
 * @param title - 需要解析的标题字符串
 * @param entries - 当前上传者的前缀表
 */
export function extractLiver( title: string, entries: ILiverEntry[] ): string | null {
	const normalizedTitle = title.toLocaleLowerCase();
	const liverEntry = entries.find( ( { prefix } ) =>
		normalizedTitle.includes( prefix.toLocaleLowerCase() ),
	);
	
	return liverEntry?.liver ?? null;
}

/**
 * 清洗游戏名称字符串
 * @param gameName - 原始游戏名称
 * @returns 清理后的游戏名称
 */
export function cleanGameName( gameName: string ): string {
	return gameName
		.replace( /（[^）]*）/g, '' ) // 移除中文括号内容
		.replace( /\([^)]*\)/g, '' ) // 移除英文括号内容
		.replace( /【[^】]*】/g, '' ) // 移除英文括号内容
		.replace( /[—-]+(残缺|已爆炸)$/, '' ) // 移除后缀标记
		.replace( /^残缺[—-]+/, '' ) // 移除前缀标记
		.replace( /(初体验|【?直播录像】?|直播实况|实况)/, '' ) // 移除后缀标记
		.trim();
}
