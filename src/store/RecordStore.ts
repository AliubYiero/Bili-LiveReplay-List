import { cwd } from 'node:process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'node:path';
import {
	CacheItem,
	IRecord,
	RecordItem,
	UnparseRecordItem,
} from '../interface/IRecord.ts';


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
		// 如果没有配置文件, 创建配置文件
		if ( !existsSync( this.configFilePath ) ) {
			this.setConfig( {
				cache: {
					uid: uid,
					userName: userName,
					aid: 0,
					timestamp: 0,
				},
				records: [],
			} );
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
	updateCacheTimestamp( timestamp: number ) {
		this.records.cache.timestamp = timestamp;
		this.setConfig( this.records );
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
	replaceRecord( record: RecordItem ) {
		delete record.updateTime;
		this.recordMap.set( record.aid, record );
		this.records.records = Array.from( this.recordMap.values() );
		this.setConfig( this.records );
	}
	
	/**
	 * 添加记录
	 */
	addRecord( ...record: RecordItem[] ) {
		const willUpdateRecordList = record.filter( item => {
			if ( item.updateTime === false ) {
				this.replaceRecord( item );
			}
			
			return item.updateTime !== false;
		} );
		if ( willUpdateRecordList.length === 0 ) {
			this.updateCacheTimestamp( Date.now() );
			return;
		}
		this.records.cache.aid = willUpdateRecordList[ 0 ].aid;
		record.reverse();
		this.records.records.push( ...record );
		this.updateCacheTimestamp( Date.now() );
		this.setConfig( this.records );
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
	private setConfig( records: IRecord ) {
		this.records = records;
		this.recordMap = this.getRecordMap();
		const recordContent = JSON.stringify( this.records );
		writeFileSync( this.configFilePath, recordContent, 'utf8' );
	}
}
