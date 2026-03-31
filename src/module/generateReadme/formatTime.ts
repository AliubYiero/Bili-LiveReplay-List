/**
 * 将给定的秒数格式化为 `hh:mm:ss` 格式的时间字符串。
 * 每个时间单位（小时、分钟、秒）均以两位数字表示，不足两位时左侧补零。
 * 支持任意非负整数或浮点数输入，小数部分会被向下取整（即截断为整数秒）。
 *
 * @example
 * formatTime(0)       // "00:00:00"
 * formatTime(61)      // "00:01:01"
 * formatTime(3661)    // "01:01:01"
 * formatTime(90061)   // "25:01:01"
 *
 * @param second - 要格式化的总秒数，必须为非负数。若传入负数，将抛出错误。
 * @returns 格式化后的 `hh:mm:ss` 字符串，其中每部分均占两位。
 * @throws {RangeError} 当输入为负数时抛出。
 */
export function formatTime( second: number ): string {
	if ( second < 0 ) {
		throw new RangeError( 'Input seconds must be non-negative.' );
	}
	
	// 截断小数部分，仅处理整数秒
	const totalSeconds = Math.floor( second );
	
	const hours = Math.floor( totalSeconds / 3600 );
	const minutes = Math.floor( ( totalSeconds % 3600 ) / 60 );
	const seconds = totalSeconds % 60;
	
	const pad = ( num: number ): string => num.toString().padStart( 2, '0' );
	
	return `${ pad( hours ) }:${ pad( minutes ) }:${ pad( seconds ) }`;
}
 
