/**
 * 根据输入的时间戳生成北京时区（UTC+8）格式为 `yyyy-mm-dd` 的日期字符串。
 * 若年、月、日中任意部分因时间戳无效或超出范围而无法解析，则对应位置使用占位符 `'----'`（年）、`'--'`（月）、`'--'`（日）补全。
 *
 * @param timestamp - 输入的时间戳（单位：毫秒）。可以是任意 number，包括无效值（如 NaN、Infinity）或超出 Date 构造函数有效范围的值。
 * @returns 格式为 `yyyy-mm-dd` 的字符串。其中：
 *   - 年份部分为 4 位数字，若无效则替换为 `'----'`
 *   - 月份部分为 2 位数字（01-12），若无效则替换为 `'--'`
 *   - 日期部分为 2 位数字（01-31），若无效则替换为 `'--'`
 *
 * @example
 * formatDate(1704067200000) // "2024-01-01"
 * formatDate(NaN)           // "----/--/--"
 * formatDate(-1)            // "1969-12-31"（有效时间戳，即使为负）
 * formatDate(8640000000000000) // "----/--/--"（超出 Date 有效范围）
 */
export function formatDate( timestamp: number ): string {
	// 检查是否为有效有限数值
	if ( !isFinite( timestamp ) ) {
		return '----/--/--';
	}
	
	// 创建一个日期对象（内部存储为UTC时间）
	const date = new Date( timestamp );
	
	// 检查 Date 是否有效
	if ( isNaN( date.getTime() ) ) {
		return '----/--/--';
	}
	
	// 将UTC时间转换为北京时间（UTC+8）
	// 方法：获取UTC时间，然后加上8小时得到北京时间
	const beijingOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
	const beijingTime = date.getTime() + beijingOffset;
	const beijingDate = new Date( beijingTime );
	
	// 使用UTC方法来获取北京时间的年、月、日
	const year = beijingDate.getUTCFullYear();
	const month = beijingDate.getUTCMonth() + 1; // getUTCMonth() 返回 0-11
	const day = beijingDate.getUTCDate();
	
	// 验证提取的日期组件是否合理
	if ( !Number.isInteger( year ) || year < 0 || year > 9999 ) {
		return '----/--/--';
	}
	
	// 格式化填充函数
	const pad = ( num: number, width: number ): string => {
		const str = String( num );
		return str.length >= width ? str : '0'.repeat( width - str.length ) + str;
	};
	
	// 格式化各部分
	const yearStr = pad( year, 4 );
	const monthStr = isNaN( month ) || month < 1 || month > 12 ? '--' : pad( month, 2 );
	const dayStr = isNaN( day ) || day < 1 || day > 31 ? '--' : pad( day, 2 );
	
	// 如果月或日无效，返回部分占位符
	if ( monthStr === '--' || dayStr === '--' ) {
		return `${ yearStr }/--/--`;
	}
	
	return `${ yearStr }-${ monthStr }-${ dayStr }`;
}
