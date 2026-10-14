/**
 * 解析视频时长, 统一返回秒
 *
 * - 直播回放接口 (`/x/series/archives`) 返回数字秒, 原样返回
 * - 主页视频接口 (`/x/space/wbi/arc/search`) 返回 `HH:MM:SS` / `MM:SS` 字符串, 换算成秒
 *
 * 时长只影响展示, 解析失败时告警并返回 0 —— 不该为一条异常的时长中断整次采集。
 */
export const parseDuration = ( value: string | number ): number => {
	if ( typeof value === 'number' ) {
		if ( !Number.isFinite( value ) || value < 0 ) return 0;
		return Math.floor( value );
	}

	const parts = String( value ?? '' ).trim().split( ':' );
	// 只接受 `MM:SS` 与 `HH:MM:SS` 两种形式
	if ( parts.length === 2 || parts.length === 3 ) {
		const numbers = parts.map( part => Number( part ) );
		const isValid = numbers.every( number => Number.isInteger( number ) && number >= 0 );
		if ( isValid ) {
			return numbers.reduce( ( total, number ) => total * 60 + number, 0 );
		}
	}

	console.warn( `无法解析视频时长 "${ value }", 已按 0 处理` );
	return 0;
};
