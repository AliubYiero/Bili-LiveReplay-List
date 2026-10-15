import { RecordItem, UnparseRecordItem } from '../../interface/IRecord.ts';
import { ILiverEntry } from '../../config/parseMapper.config.ts';
import {
	cleanGameName,
	extractLiveDate,
	extractLiver,
} from './handleParseUtils.ts';

/**
 * 单个上传者的解析函数
 *
 * `entries` 是该上传者自己的前缀表, 不需要解析主播时可为空数组。
 */
export type Parser = (
	item: UnparseRecordItem,
	entries: ILiverEntry[],
) => Promise<RecordItem | null>;

/**
 * 上传者 uid → 解析函数
 *
 * 与 `config/parseMapper.config.ts` 的 `PARSE_MAPPER_CONFIG` 必须一一对应,
 * 由 `assertValidParseMapper` 在启动时校验。
 */
export const PARSERS: Record<number, Parser> = {
	245335: async ( item, entries ) => {
		// 1. 匹配主播前缀
		const liver = extractLiver( item.title, entries );
		if ( !liver ) return null;
		
		// 2. 提取直播日期
		const liveTime = extractLiveDate( item.title, item.publishTime );
		
		// 3. 提取游戏列表（匹配所有《》包裹的内容）
		const playGameList = item.title.match( /(?<=《)[^》]+(?=》)/g );
		
		// 4. 验证必要数据
		if ( !playGameList || playGameList.length === 0 ) return null;
		
		return {
			...item,
			liveTime,
			playGame: playGameList,
			liver,
		};
	},
	1400350754: async ( item, entries ) => {
		// 1. 匹配播主前缀
		const liver = extractLiver( item.title, entries );
		if ( !liver ) return null;
		
		// 2. 提取直播日期
		const liveTime = extractLiveDate( item.title, item.publishTime );
		
		// 3. 提取游戏部分（匹配日期后的所有内容）
		const gameMatch = item.title.match( /【.*?录播】\s*\d{2,4}-\d{1,2}-\d{1,2}\s+(.+)/i );
		if ( !gameMatch || !gameMatch[ 1 ] ) return null;
		
		// 4. 清洗并分割游戏名称
		const playGameList = gameMatch[ 1 ]
			.split( '+' )
			.map( cleanGameName )
			.filter( name => name.length > 0 ); // 过滤空名称
		
		// 5. 验证必要数据
		if ( playGameList.length === 0 ) return null;
		
		return {
			...item,
			liveTime: liveTime,
			playGame: playGameList,
			liver,
		};
	},
	15810: async ( item ) => {
		// play Game
		const { title } = item;
		const gameMatch = title.match( /(【Quin】|【Mr.Quin】)(.*)(【?直播录像|直播实况|实况)/ )
			|| title.match( /(【Quin】|【Mr.Quin】|【Mr.Quin X 鱼炒剩饭】)(.*)/ );
		if ( !( Array.isArray( gameMatch ) && gameMatch[ 2 ] ) ) return null;
		// 4. 清洗并分割游戏名称
		const playGameList = gameMatch[ 2 ]
			.split( /[+&]/g )
			.map( cleanGameName )
			.filter( name => name.length > 0 ); // 过滤空名称
		
		return {
			...item,
			liveTime: item.publishTime,
			playGame: playGameList,
			liver: 'Mr.Quin',
		};
	},
	690608693: async ( item ) => {
		// 只监听直播回放
		if ( !item.title.includes( '【直播回放】' ) ) return null;
		
		// 提取直播时间
		const liveTime = extractLiveDate( item.title, item.publishTime );
		
		// 提取直播游戏
		const prefixLength = '【直播回放】'.length;
		const playGameMatches = item.title.slice( prefixLength )
			.match( /(?<=【)[^】]+(?=】)/g );
		const playGameList: string[] = [];
		if ( !playGameMatches ) {
			playGameList.push( '杂谈' );
		}
		else {
			playGameList.push( ...playGameMatches[ 0 ].split( '+' ).map( item => item.trim() ) );
		}
		
		return {
			...item,
			liveTime: liveTime,
			playGame: playGameList,
			liver: '勾檀Mayumi',
		};
	},
};
