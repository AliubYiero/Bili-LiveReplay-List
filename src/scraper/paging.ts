import { NormalizedPage } from './normalize.ts';

/**
 * 由总条数与每页条数计算总页数
 */
export const calcMaxPage = ( total: number, pageSize: number ): number => {
	if ( !Number.isFinite( total ) || !Number.isFinite( pageSize ) || pageSize <= 0 ) {
		return 1;
	}
	return Math.max( 1, Math.ceil( total / pageSize ) );
};

/**
 * 判断是否应该停止翻页
 *
 * 停止条件（任一命中）:
 * - 当前页没有数据
 * - 已经翻到总页数
 * - 已经翻到页数上限
 */
export const shouldStopPaging = (
	page: NormalizedPage,
	limitPages: number,
): boolean => {
	if ( page.archives.length === 0 ) return true;
	if ( page.currentPage >= limitPages ) return true;
	return page.currentPage >= calcMaxPage( page.total, page.pageSize );
};
