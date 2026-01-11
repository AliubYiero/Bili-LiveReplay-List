import { RecordItem, UnparseRecordItem } from '../../interface/IRecord.ts';

export interface IParseItem {
	uid: number;
	userName: string;
	onParse: ( item: UnparseRecordItem ) => Promise<RecordItem | null>;
}

// 直播者
const liverEntries: [ string, RecordItem['liver'] ][] = [
	[ '【机皇录播】', '机皇' ],
	[ '【Quin？机皇！】', '机皇' ],
	[ '【肯尼录播】', '机智的肯尼' ],
	[ '【剩饭录播】', '北极熊剩饭' ],
	[ '【quin录播】', 'Mr.Quin' ],
	[ '【Mr.Quin】', 'Mr.Quin' ],
];

export const handleParseMapper: IParseItem[] = [
	{
		uid: 245335,
		userName: '胧黑',
		onParse: async ( item: UnparseRecordItem ) => {
			const liverEntry = liverEntries
				.find( ( [ livePrefix ] ) => item.title.includes( livePrefix ) );
			if ( !liverEntry ) return null;
			const liver = liverEntry[ 1 ];
			
			// 直播日期
			const [ _, year, month, day ] = item.title.match( /(\d{2,4})年(\d{1,2})月(\d{1,2})日/ ) || [];
			let liveTime: number = ( year && month && day )
				? new Date(
					Number( year ),
					Number( month ) - 1,
					Number( day ),
				).getTime()
				: new Date( item.publishTime ).getTime();
			const playGameList = item.title.match( /(?<=《)[^》]+(?=》)/g );
			if ( !playGameList ) return null;
			return {
				...item,
				liveTime: liveTime,
				playGame: playGameList,
				liver: liver,
			};
		},
	},
	{
		uid: 1400350754,
		userName: '自行车二层',
		onParse: async ( item: UnparseRecordItem ) => {
			const liverEntry = liverEntries
				.find( ( [ livePrefix ] ) => item.title.toLocaleLowerCase().includes( livePrefix.toLocaleLowerCase() ) );
			if ( !liverEntry ) return null;
			const liver = liverEntry[ 1 ];
			// 直播日期
			const [ _, year, month, day ] = item.title.match( /(\d{2,4})-(\d{1,2})-(\d{1,2})/ ) || [];
			let liveTime: number = ( year && month && day )
				? new Date(
					Number( year.length === 2 ? `20${ year }` : year ),
					Number( month ) - 1,
					Number( day ),
				).getTime()
				: new Date( item.publishTime ).getTime();
			// 直播游戏
			const playGameMatches = item.title.match( /【.*?录播】 \d{2,4}-\d{1,2}-\d{1,2} (.*)/ ) || [];
			if ( !playGameMatches[ 1 ] ) return null;
			const playGameList = playGameMatches[ 1 ].split( '+' )
				.map( str => {
					return str
						.replace(/（[^）]*）/g, '')
						.replace(/\([^)]*\)/g, '')
						.replace(/[—-]+(残缺|已爆炸)$/, '')
						.replace(/^残缺[—-]+/, '')
						.trim();
				} );
			if ( !Array.isArray( playGameList ) || !playGameList[ 0 ] ) return null;
			return {
				...item,
				liveTime: liveTime,
				playGame: playGameList,
				liver,
			};
		},
	},
];
