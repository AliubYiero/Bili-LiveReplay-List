import { RecordItem, UnparseRecordItem } from '../../interface/IRecord.ts';
import { cleanGameName, extractLiveDate, extractLiver } from './handleParseUtils.ts';

export interface IParseItem {
	uid: number;
	userName: string;
	onParse: ( item: UnparseRecordItem ) => Promise<RecordItem | null>;
}

/**
 * 预定义的播主前缀映射表
 * @constant
 * @type {Array<[string, RecordItem['liver']]>}
 */
export const LIVER_ENTRIES: [ string, RecordItem['liver'] ][] = [
	[ '【机皇录播】', '机皇' ],
	[ '【Quin？机皇！】'.toLocaleLowerCase(), '机皇' ],
	[ '【肯尼录播】', '机智的肯尼' ],
	[ '【剩饭录播】', '北极熊剩饭' ],
	[ '【quin录播】'.toLocaleLowerCase(), 'Mr.Quin' ],
	[ '【Mr.Quin】'.toLocaleLowerCase(), 'Mr.Quin' ],
] as const;


export const handleParseMapper: IParseItem[] = [
	{
		uid: 245335,
		userName: '胧黑',
		onParse: async ( item: UnparseRecordItem ) => {
			// 1. 匹配主播前缀
			const liver = extractLiver( item.title );
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
	},
	{
		uid: 1400350754,
		userName: '自行车二层',
		onParse: async ( item: UnparseRecordItem ) => {
			// 1. 匹配播主前缀
			const liver = extractLiver( item.title );
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
	},
];
