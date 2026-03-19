import { cwd } from 'node:process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'node:path';
import {
	CacheItem,
	IRecord,
	RecordItem,
	UnparseRecordItem,
} from '../interface/IRecord.ts';
import { atomicWriteJSON } from '../utils/fileLock.ts';


export class RecordStore {
	// 配置目录
	private readonly configDir = resolve( cwd(), 'config' );
	private readonly configFilePath: string;
	private records: IRecord;
	private recordMap: Map<number, RecordItem> = new Map();
	
	constructor(
		private uid: number,
		userName: string = '',
	) {
		this.configFilePath = join( this.configDir, `${ uid }.record.json` );
		// 如果没有配置目录, 创建目录
		if ( !existsSync( this.configDir ) ) {
			mkdirSync( this.configDir, { recursive: true } );
		}
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
	 * 判断是否到达缓存点
	 */
	arrivedCachePoint( aid: number ) {
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
		willUpdateRecordList.reverse();
		this.records.records.push( ...willUpdateRecordList );
		await this.updateCacheTimestamp( Date.now() );
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
