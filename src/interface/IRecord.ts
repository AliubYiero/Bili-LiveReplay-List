/** 单个数据源类型 */
export type VideoSourceType = 'upload' | 'replay';

/** 配置中可选择的数据源类型 */
export type VideoSourceOption = VideoSourceType | 'both';

/** 所有数据源类型, 用于遍历 */
export const VIDEO_SOURCE_TYPES: VideoSourceType[] = [ 'upload', 'replay' ];

export interface CacheItem {
	uid: number;
	userName: string;
	aid: number;
	timestamp: number;
	/**
	 * 各数据源各自的缓存点 aid
	 *
	 * 旧数据没有这个字段, 此时 `RecordStore.arrivedCachePoint` 会回退到标量 `aid`。
	 * 单数据源场景下两者语义一致, 只有在 `both` 模式下才必须区分。
	 */
	aidBySource?: Partial<Record<VideoSourceType, number>>;
}

export interface UnparseRecordItem {
	aid: number;
	bvId: string;
	publishTime: number;
	liveDuration: number;
	title: string;
	updateTime?: boolean;
	/**
	 * 临时字段: 该记录来自哪个数据源
	 *
	 * 只用于 `RecordStore.addRecord` 维护各数据源自己的缓存点, 不会写入 record.json。
	 * 与 `updateTime` 一样属于「只在内存中流转」的标记位。
	 */
	sourceType?: VideoSourceType;
}

export interface RecordItem extends UnparseRecordItem {
	liveTime: number;
	playGame: string[];
	liver: 'Mr.Quin' | '机智的肯尼' | '北极熊剩饭' | '机皇' | string;
}

export type PlayGameRecordItem = Omit<RecordItem, 'playGame'> & {
	playGame: string
}

export interface IRecord {
	cache: CacheItem;
	records: Array<RecordItem>;
}
