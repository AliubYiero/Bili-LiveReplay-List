import { UnparseRecordItem, VideoSourceType } from '../interface/IRecord.ts';
import { parseDuration } from './parseDuration.ts';

/**
 * 归一化后的单页数据
 *
 * 两种数据源的响应结构完全不同, 在这里统一成同一形状, 调用方无需关心来源。
 */
export interface NormalizedPage {
	sourceType: VideoSourceType;
	currentPage: number;
	pageSize: number;
	total: number;
	archives: UnparseRecordItem[];
}

/** 主页视频接口 `/x/space/wbi/arc/search` 的响应 */
export interface SpaceArcSearchResponse {
	code?: number;
	message?: string;
	data?: {
		list?: {
			vlist?: SpaceArcSearchItem[];
		};
		page?: {
			/** 总条数 */
			count?: number;
			/**
			 * 当前页码
			 *
			 * ⚠️ 实测（2026-10-15）这个接口返回的字段名是 `pn`（形如 `{"pn":1,"ps":40,"count":1105}`），
			 * 不是 `/x/series/archives` 那种 `num`。读错会导致页码永远不推进、翻页空转。
			 * `num` 保留为兜底。
			 */
			pn?: number;
			num?: number;
			/** 每页条数 */
			ps?: number;
			size?: number;
		};
	};
}

export interface SpaceArcSearchItem {
	aid: number;
	bvid: string;
	title: string;
	/** 发布时间, 秒 */
	created: number;
	/** 时长, `HH:MM:SS` 字符串 */
	length: string;
}

/** 直播回放接口 `/x/series/archives` 的响应 */
export interface SeriesArchivesResponse {
	code?: number;
	message?: string;
	data?: {
		archives?: SeriesArchivesItem[];
		page?: {
			num?: number;
			size?: number;
			total?: number;
		};
	};
}

export interface SeriesArchivesItem {
	aid: number;
	bvid: string;
	title: string;
	/** 发布时间, 秒 */
	pubdate: number;
	/** 时长, 秒 */
	duration: number;
}

/**
 * 归一化主页视频 (`upload`) 的响应
 */
export const normalizeUploadResponse = (
	response: SpaceArcSearchResponse,
): NormalizedPage => {
	const videoList = response.data?.list?.vlist ?? [];
	const page = response.data?.page;

	return {
		sourceType: 'upload',
		currentPage: page?.pn ?? page?.num ?? 1,
		pageSize: page?.ps ?? page?.size ?? videoList.length,
		total: page?.count ?? videoList.length,
		archives: videoList.map( item => ( {
			aid: item.aid,
			bvId: item.bvid,
			publishTime: item.created * 1000,
			liveDuration: parseDuration( item.length ),
			title: item.title,
			sourceType: 'upload' as const,
		} ) ),
	};
};

/**
 * 归一化直播回放 (`replay`) 的响应
 */
export const normalizeReplayResponse = (
	response: SeriesArchivesResponse,
): NormalizedPage => {
	const archiveList = response.data?.archives ?? [];
	const page = response.data?.page;

	return {
		sourceType: 'replay',
		currentPage: page?.num ?? 1,
		pageSize: page?.size ?? archiveList.length,
		total: page?.total ?? archiveList.length,
		archives: archiveList.map( item => ( {
			aid: item.aid,
			bvId: item.bvid,
			publishTime: item.pubdate * 1000,
			liveDuration: parseDuration( item.duration ),
			title: item.title,
			sourceType: 'replay' as const,
		} ) ),
	};
};
