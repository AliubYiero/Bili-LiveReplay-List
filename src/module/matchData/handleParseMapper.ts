import { RecordItem, UnparseRecordItem, VideoSourceOption } from '../../interface/IRecord.ts';
import {
	cleanGameName,
	extractLiveDate,
	extractLiver,
} from './handleParseUtils.ts';

export interface IParseItem {
	uid: number;
	userName: string;
	/** 该 UID 的数据源类型: 主页视频 / 直播回放 / 两者都采集 */
	videoSourceType: VideoSourceOption;
	/** 直播回放合集 ID, `replay` / `both` 时必需 */
	seriesId?: number;
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
		videoSourceType: 'upload',
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
		videoSourceType: 'upload',
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
	{
		uid: 15810,
		userName: 'Mr.Quin',
		videoSourceType: 'upload',
		onParse: async ( item: UnparseRecordItem ) => {
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
	},
	{
		uid: 690608693,
		userName: '勾檀Mayumi',
		videoSourceType: 'replay',
		seriesId: 91376,
		onParse: async ( item: UnparseRecordItem ) => {
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
	},
];

/**
 * 启动时校验解析器配置
 *
 * 直播回放必须有 seriesId, 否则等采集到一半才报错太晚了。
 */
export const assertValidParseMapper = (
	mapper: IParseItem[] = handleParseMapper,
) => {
	for ( const { uid, userName, videoSourceType, seriesId } of mapper ) {
		if ( ( videoSourceType === 'replay' || videoSourceType === 'both' ) && !seriesId ) {
			throw new Error(
				`配置错误: 用户 ${ userName }(uid:${ uid }) 的 videoSourceType 为 "${ videoSourceType }", 必须同时配置 seriesId`,
			);
		}
	}
};
