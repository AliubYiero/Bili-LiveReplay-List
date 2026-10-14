import { existsSync, readFileSync, writeFileSync } from 'fs';
import {
	CacheItem,
	IRecord,
	RecordItem,
	UnparseRecordItem,
	VideoSourceType,
} from '../interface/IRecord.ts';
import { atomicWriteJSON } from '../utils/fileLock.ts';
import { DataPathManager } from '../utils/DataPathManager.ts';


export class RecordStore {
	// 配置文件路径
	private readonly configFilePath: string;
	private records: IRecord;
	private recordMap: Map<number, RecordItem> = new Map();
	
	constructor(
		private uid: number,
		private userName: string,
	) {
		const paths = DataPathManager.getUserFilePaths(uid, userName);
		this.configFilePath = paths.recordPath;
		
		// 目录已由 getUserDataDir 自动创建，无需额外处理
		
		// 如果没有配置文件, 创建配置文件 (构造函数中使用同步写入)
		if ( !existsSync( this.configFilePath ) ) {
			const initialConfig: IRecord = {
				cache: {
					uid: uid,
					userName: userName,
					aid: 0,
					timestamp: 0,
				},
				records: [],
			};
			writeFileSync( this.configFilePath, JSON.stringify( initialConfig ), 'utf8' );
		}
		
		// 获取完整配置
		this.records = this.getConfig();
	}
	
	/**
	 * 读取缓存
	 */
	get cache(): CacheItem {
		return this.records.cache;
	}
	
	/**
	 * 读取记录
	 */
	get recordList(): RecordItem[] {
		return this.records.records;
	}
	
	/**
	 * 判断某个数据源是否到达缓存点
	 *
	 * 优先使用该数据源自己的缓存点；旧数据没有 `aidBySource` 字段时
	 * 回退到标量 `aid`（单数据源场景下两者语义完全一致）。
	 */
	arrivedCachePoint( sourceType: VideoSourceType, aid: number ) {
		const sourceCachePoint = this.cache.aidBySource?.[ sourceType ];
		if ( sourceCachePoint !== undefined ) {
			return sourceCachePoint === aid;
		}
		return this.cache.aid === aid;
	}
	
	/**
	 * 更新缓存的时间点
	 */
	async updateCacheTimestamp( timestamp: number ) {
		this.records.cache.timestamp = timestamp;
		await this.setConfig( this.records );
	}
	
	/**
	 * 检查传入的记录标题和缓存中是否一致
	 */
	checkCacheVideoTitle( record: UnparseRecordItem ): boolean {
		const currentRecord = this.recordMap.get( record.aid );
		if ( !currentRecord ) {
			return true;
		}
		if ( currentRecord.title !== record.title ) {
			console.info( `用户 ${ this.uid } 的视频 av${ record.aid } 更改了标题` );
			return false;
		}
		return true;
	}
	
	/**
	 * 删除记录 (不添加进文件存储中)
	 */
	deleteRecord( record: UnparseRecordItem ) {
		this.recordMap.delete( record.aid );
		this.records.records = Array.from( this.recordMap.values() );
	}
	
	/**
	 * 替换记录
	 */
	async replaceRecord( record: RecordItem ) {
		delete record.updateTime;
		delete record.sourceType;
		this.recordMap.set( record.aid, record );
		this.records.records = Array.from( this.recordMap.values() );
		await this.setConfig( this.records );
	}
	
	/**
	 * 添加记录
	 */
	async addRecord( ...record: RecordItem[] ) {
		// 先处理需要替换的记录
		for ( const item of record ) {
			if ( item.updateTime === false ) {
				await this.replaceRecord( item );
			}
		}

		// 过滤出需要添加的记录
		const willUpdateRecordList = record.filter( item => {
			return item.updateTime !== false;
		} );

		if ( willUpdateRecordList.length === 0 ) {
			await this.updateCacheTimestamp( Date.now() );
			return;
		}
		this.records.cache.aid = willUpdateRecordList[ 0 ].aid;
		this.updateCacheAidBySource( willUpdateRecordList );
		willUpdateRecordList.reverse();
		// sourceType 只用于维护分源缓存点, 不落到盘上
		for ( const item of willUpdateRecordList ) {
			delete item.sourceType;
		}
		this.records.records.push( ...willUpdateRecordList );
		await this.updateCacheTimestamp( Date.now() );
	}

	/**
	 * 维护各数据源自己的缓存点
	 *
	 * `records` 按发布时间倒序, 因此每个数据源第一次出现的那条就是它最新的新增视频。
	 * 用 `seenSourceTypes` 而不是「当前值为 undefined」来判断, 是为了让每次运行
	 * 都把缓存点推进到本轮的最新一条, 而不是停留在第一次写入的位置。
	 */
	private updateCacheAidBySource( records: UnparseRecordItem[] ) {
		const aidBySource: Partial<Record<VideoSourceType, number>> = {
			...this.records.cache.aidBySource,
		};
		const seenSourceTypes = new Set<VideoSourceType>();

		for ( const record of records ) {
			if ( !record.sourceType ) continue;
			if ( seenSourceTypes.has( record.sourceType ) ) continue;

			seenSourceTypes.add( record.sourceType );
			aidBySource[ record.sourceType ] = record.aid;
		}

		this.records.cache.aidBySource = aidBySource;
	}
	
	/**
	 * 获取完整配置
	 */
	private getConfig(): IRecord {
		const recordContent = readFileSync( this.configFilePath, 'utf8' );
		this.records = JSON.parse( recordContent );
		this.recordMap = this.getRecordMap();
		return this.records;
	}
	
	/**
	 * 获取 RecordMap
	 */
	private getRecordMap() {
		return this.records.records.reduce( ( result: Map<number, RecordItem>, item ) => {
			result.set( item.aid, item );
			return result;
		}, new Map() );
	}
	
	/**
	 * 设置完整配置
	 */
	private async setConfig( records: IRecord ) {
		this.records = records;
		this.recordMap = this.getRecordMap();
		await atomicWriteJSON( this.configFilePath, this.records );
	}
}
