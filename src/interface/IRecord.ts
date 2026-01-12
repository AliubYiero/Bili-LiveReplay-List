export interface CacheItem {
	uid: number;
	userName: string;
	aid: number;
	timestamp: number;
}

export interface UnparseRecordItem {
	aid: number;
	bvId: string;
	publishTime: number;
	liveDuration: number;
	title: string;
	updateTime?: boolean;
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
