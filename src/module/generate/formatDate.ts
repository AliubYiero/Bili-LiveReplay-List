/**
 * 根据输入的时间戳生成格式为 `yyyy-mm-dd` 的日期字符串。
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
	
	const date = new Date( timestamp );
	
	// 检查 Date 是否有效（Date 构造函数对非法时间戳会返回 Invalid Date）
	if ( isNaN( date.getTime() ) ) {
		return '----/--/--';
	}
	
	const year = date.getFullYear();
	const month = date.getMonth() + 1; // getMonth() 返回 0-11
	const day = date.getDate();
	
	// 验证提取的日期组件是否合理（防御性检查，通常不会失败，但增强健壮性）
	if ( !Number.isInteger( year ) || year < 0 || year > 9999 ) {
		return '----/--/--';
	}
	
	const pad = ( num: number, width: number ): string => {
		const str = String( num );
		return str.length >= width ? str : '0'.repeat( width - str.length ) + str;
	};
	
	const yearStr = pad( year, 4 );
	const monthStr = isNaN( month ) || month < 1 || month > 12 ? '--' : pad( month, 2 );
	const dayStr = isNaN( day ) || day < 1 || day > 31 ? '--' : pad( day, 2 );
	
	// 再次验证 month 和 day 是否为有效整数（理论上不会发生，但保持防御）
	if ( monthStr === '--' || dayStr === '--' ) {
		return `${ yearStr }/--/--`;
	}
	
	return `${ yearStr }-${ monthStr }-${ dayStr }`;
}
