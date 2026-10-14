import { Browser } from 'playwright';
import { playwrightStreamPages } from '../../scraper/playwrightStreamPages.ts';
import {
	UnparseRecordItem,
	VideoSourceOption,
	VideoSourceType,
} from '../../interface/IRecord.ts';
import { RecordStore } from '../../store/RecordStore.ts';

/**
 * 把 `both` 模式下两个数据源的采集结果归并成一份列表
 *
 * 按 `publishTime` 倒序（与单数据源时的顺序保持一致, `addRecord` 依赖
 * 「第一条就是最新视频」来推进缓存点）, 并按 `aid` 去重。
 */
export const mergeSourceVideoList = (
	videoList: UnparseRecordItem[],
): UnparseRecordItem[] => {
	const mergedMap = new Map<number, UnparseRecordItem>();
	for ( const video of videoList ) {
		if ( !mergedMap.has( video.aid ) ) {
			mergedMap.set( video.aid, video );
		}
	}
	return Array.from( mergedMap.values() )
		.sort( ( a, b ) => b.publishTime - a.publishTime );
};

/**
 * 采集单个数据源的增量视频列表
 *
 * 遇到缓存点后, 仍然把当前页剩下的视频跑一遍标题比对（视频改标题时要重新收录）,
 * 然后停止翻页。这与替换采集层之前的行为一致。
 */
const collectSourceVideoList = async (
	uid: number,
	sourceType: VideoSourceType,
	seriesId: number | undefined,
	configStore: RecordStore,
	browser: Browser,
): Promise<UnparseRecordItem[]> => {
	const videoList: UnparseRecordItem[] = [];
	let checkCache = false;

	for await ( const pageData of playwrightStreamPages( browser, uid, sourceType, seriesId ) ) {
		for ( const archive of pageData.archives ) {
			// 到达缓存点之后, 只做标题比对
			if ( checkCache ) {
				if ( !configStore.checkCacheVideoTitle( archive ) ) {
					archive.updateTime = false;
					videoList.push( archive );
				}
				continue;
			}

			// 命中缓存点: 本条及其后的视频都不再作为新增
			if ( configStore.arrivedCachePoint( sourceType, archive.aid ) ) {
				checkCache = true;
				if ( !configStore.checkCacheVideoTitle( archive ) ) {
					archive.updateTime = false;
					videoList.push( archive );
				}
				continue;
			}

			videoList.push( archive );
		}

		// 当前页处理完就停, 生成器会在 break 时关闭 context
		if ( checkCache ) break;
	}

	return videoList;
};

/**
 * 获取增量的视频列表
 *
 * @param uid 上传者 UID
 * @param videoSourceType 数据源类型, `both` 时分别采集后归并
 * @param seriesId 直播回放合集 ID, `replay` / `both` 时必需
 * @param configStore 录播记录存储, 提供各数据源的缓存点
 * @param browser 全局复用的浏览器实例
 */
export const getIncrementalVideoList = async (
	uid: number,
	videoSourceType: VideoSourceOption,
	seriesId: number | undefined,
	configStore: RecordStore,
	browser: Browser,
): Promise<UnparseRecordItem[]> => {
	const sourceTypes: VideoSourceType[] = videoSourceType === 'both'
		? [ 'upload', 'replay' ]
		: [ videoSourceType ];

	const collected: UnparseRecordItem[] = [];
	for ( const sourceType of sourceTypes ) {
		const sourceVideoList = await collectSourceVideoList(
			uid,
			sourceType,
			seriesId,
			configStore,
			browser,
		);
		collected.push( ...sourceVideoList );
	}

	if ( sourceTypes.length === 1 ) {
		return collected;
	}

	return mergeSourceVideoList( collected );
};
