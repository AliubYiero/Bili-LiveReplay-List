import {
	assertValidParseMapper,
	handleParseMapper,
	IParseItem,
} from '../../../../module/matchData/handleParseMapper.ts';
import { Parser } from '../../../../module/matchData/parsers.ts';
import {
	PARSE_MAPPER_BY_UID,
	PARSE_MAPPER_CONFIG,
} from '../../../../config/parseMapper.config.ts';
import { UnparseRecordItem } from '../../../../interface/IRecord.ts';

describe( 'handleParseMapper', () => {
	describe( 'PARSE_MAPPER_CONFIG liver entries', () => {
		it( 'should declare each uploader\u2019s prefixes', () => {
			expect( PARSE_MAPPER_BY_UID[ 245335 ].liverEntries ).toEqual( [
				{ prefix: '【机皇录播】', liver: '机皇' },
				{ prefix: '【Quin？机皇！】', liver: '机皇' },
			] );
			expect( PARSE_MAPPER_BY_UID[ 1400350754 ].liverEntries ).toEqual( [
				{ prefix: '【机皇录播】', liver: '机皇' },
				{ prefix: '【Quin？机皇！】', liver: '机皇' },
				{ prefix: '【肯尼录播】', liver: '机智的肯尼' },
				{ prefix: '【剩饭录播】', liver: '北极熊剩饭' },
				{ prefix: '【quin录播】', liver: 'Mr.Quin' },
				{ prefix: '【Mr.Quin】', liver: 'Mr.Quin' },
			] );
		} );

		it( 'should not declare prefixes for uploaders that do not parse a liver', () => {
			expect( PARSE_MAPPER_BY_UID[ 15810 ].liverEntries ).toBeUndefined();
			expect( PARSE_MAPPER_BY_UID[ 690608693 ].liverEntries ).toBeUndefined();
		} );

		it( 'should keep prefixes unnormalized in config', () => {
			const hasUppercase = PARSE_MAPPER_CONFIG
				.flatMap( config => config.liverEntries ?? [] )
				.some( ( { prefix } ) => prefix !== prefix.toLocaleLowerCase() );
			expect( hasUppercase ).toBe( true );
		} );
	} );

	describe( 'handleParseMapper array', () => {
		it( 'should contain all four uploaders', () => {
			expect( handleParseMapper ).toHaveLength( 4 );
			expect( handleParseMapper.map( item => item.uid ) ).toEqual( [ 245335, 1400350754, 15810, 690608693 ] );
		} );

		it( 'should have correct user names', () => {
			const userNames = handleParseMapper.map( item => item.userName );
			expect( userNames ).toContain( '胧黑' );
			expect( userNames ).toContain( '自行车二层' );
			expect( userNames ).toContain( 'Mr.Quin' );
			expect( userNames ).toContain( '勾檀Mayumi' );
		} );

		it( 'should declare a video source type for every uploader', () => {
			for ( const item of handleParseMapper ) {
				expect( [ 'upload', 'replay', 'both' ] ).toContain( item.videoSourceType );
			}
		} );

		it( 'should use the upload source for the regular uploaders', () => {
			const uploadUids = handleParseMapper
				.filter( item => item.videoSourceType === 'upload' )
				.map( item => item.uid );
			expect( uploadUids ).toEqual( [ 245335, 1400350754, 15810 ] );
		} );

		it( 'should pair the replay source with a series id', () => {
			const replayItem = handleParseMapper.find( item => item.videoSourceType === 'replay' )!;
			expect( replayItem.uid ).toBe( 690608693 );
			expect( replayItem.seriesId ).toBe( 91376 );
		} );
	} );

	describe( 'assertValidParseMapper', () => {
		const noop: Parser = async () => null;

		it( 'accepts the built-in mapper', () => {
			expect( () => assertValidParseMapper() ).not.toThrow();
		} );

		it( 'rejects a replay source without seriesId', () => {
			expect( () => assertValidParseMapper( [
				{ uid: 1, userName: 'a', videoSourceType: 'replay' },
			], { 1: noop } ) ).toThrow( /必须同时配置 seriesId/ );
		} );

		it( 'rejects a both source without seriesId', () => {
			expect( () => assertValidParseMapper( [
				{ uid: 2, userName: 'b', videoSourceType: 'both' },
			], { 2: noop } ) ).toThrow( /必须同时配置 seriesId/ );
		} );

		it( 'accepts a replay source with seriesId', () => {
			expect( () => assertValidParseMapper( [
				{ uid: 3, userName: 'c', videoSourceType: 'replay', seriesId: 1 },
			], { 3: noop } ) ).not.toThrow();
		} );

		it( 'accepts an upload source without seriesId', () => {
			expect( () => assertValidParseMapper( [
				{ uid: 4, userName: 'd', videoSourceType: 'upload' },
			], { 4: noop } ) ).not.toThrow();
		} );

		it( 'rejects a config uid that has no parser', () => {
			expect( () => assertValidParseMapper( [
				{ uid: 5, userName: 'e', videoSourceType: 'upload' },
			], {} ) ).toThrow( /PARSERS 中没有对应的解析函数/ );
		} );

		it( 'rejects a parser uid that has no config', () => {
			expect( () => assertValidParseMapper( [], { 6: noop } ) )
				.toThrow( /PARSE_MAPPER_CONFIG 中没有对应的配置/ );
		} );
	} );

	describe( '胧黑 parser (uid: 245335)', () => {
		let parser: IParseItem;

		beforeEach( () => {
			parser = handleParseMapper.find( item => item.uid === 245335 )!;
		} );

		it( 'should return parsed data for valid title with single game', async () => {
			const item: UnparseRecordItem = {
				aid: 123456789,
				bvId: 'BV1xx411c7mD',
				title: '【机皇录播】2024-01-15《艾尔登法环》',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.liver ).toBe( '机皇' );
			expect( result?.playGame ).toEqual( [ '艾尔登法环' ] );
			expect( result?.aid ).toBe( 123456789 );
		} );

		it( 'should extract multiple games from title', async () => {
			const item: UnparseRecordItem = {
				aid: 123456790,
				bvId: 'BV1xx411c7mE',
				title: '【机皇录播】2024-01-15《艾尔登法环》《只狼》《黑暗之魂》',
				publishTime: 1705312800,
				liveDuration: 7200,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.playGame ).toEqual( [ '艾尔登法环', '只狼', '黑暗之魂' ] );
		} );

		it( 'should return null when liver cannot be identified', async () => {
			const item: UnparseRecordItem = {
				aid: 123456791,
				bvId: 'BV1xx411c7mF',
				title: '【未知主播】2024-01-15《艾尔登法环》',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).toBeNull();
		} );

		it( 'should return null when no game names in title', async () => {
			const item: UnparseRecordItem = {
				aid: 123456792,
				bvId: 'BV1xx411c7mG',
				title: '【机皇录播】2024-01-15 只是聊天',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).toBeNull();
		} );

		it( 'should extract date from different formats', async () => {
			const item: UnparseRecordItem = {
				aid: 123456793,
				bvId: 'BV1xx411c7mH',
				title: '【机皇录播】2024-1-5《只狼》',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.playGame ).toEqual( [ '只狼' ] );
		} );
	} );

	describe( '自行车二层 parser (uid: 1400350754)', () => {
		let parser: IParseItem;

		beforeEach( () => {
			parser = handleParseMapper.find( item => item.uid === 1400350754 )!;
		} );

		it( 'should parse valid title with single game', async () => {
			const item: UnparseRecordItem = {
				aid: 123456794,
				bvId: 'BV1xx411c7mI',
				title: '【机皇录播】2024-01-15 艾尔登法环',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.liver ).toBe( '机皇' );
			expect( result?.playGame ).toEqual( [ '艾尔登法环' ] );
		} );

		it( 'should parse multiple games separated by plus sign', async () => {
			const item: UnparseRecordItem = {
				aid: 123456795,
				bvId: 'BV1xx411c7mJ',
				title: '【机皇录播】2024-01-15 艾尔登法环+只狼+黑暗之魂',
				publishTime: 1705312800,
				liveDuration: 10800,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.playGame ).toEqual( [ '艾尔登法环', '只狼', '黑暗之魂' ] );
		} );

		it( 'should clean game names by removing brackets but keep other text', async () => {
			const item: UnparseRecordItem = {
				aid: 123456796,
				bvId: 'BV1xx411c7mK',
				title: '【机皇录播】2024-01-15 艾尔登法环 [DLC版]',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			// Note: cleanGameName keeps square brackets but removes other special chars
			expect( result?.playGame ).toEqual( [ '艾尔登法环 [DLC版]' ] );
		} );

		it( 'should parse Mr.Quin titles correctly', async () => {
			const item: UnparseRecordItem = {
				aid: 123456797,
				bvId: 'BV1xx411c7mL',
				title: '【quin录播】2024-01-15 黑暗之魂3',
				publishTime: 1705312800,
				liveDuration: 7200,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.liver ).toBe( 'Mr.Quin' );
			expect( result?.playGame ).toEqual( [ '黑暗之魂3' ] );
		} );

		it( 'should parse 机智的肯尼 titles correctly', async () => {
			const item: UnparseRecordItem = {
				aid: 123456798,
				bvId: 'BV1xx411c7mM',
				title: '【肯尼录播】2024-01-15 双人成行',
				publishTime: 1705312800,
				liveDuration: 5400,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.liver ).toBe( '机智的肯尼' );
			expect( result?.playGame ).toEqual( [ '双人成行' ] );
		} );

		it( 'should parse 北极熊剩饭 titles correctly', async () => {
			const item: UnparseRecordItem = {
				aid: 123456799,
				bvId: 'BV1xx411c7mN',
				title: '【剩饭录播】2024-01-15 怪物猎人',
				publishTime: 1705312800,
				liveDuration: 4800,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.liver ).toBe( '北极熊剩饭' );
			expect( result?.playGame ).toEqual( [ '怪物猎人' ] );
		} );

		it( 'should return null when liver prefix not recognized', async () => {
			const item: UnparseRecordItem = {
				aid: 123456800,
				bvId: 'BV1xx411c7mO',
				title: '【未知录播】2024-01-15 艾尔登法环',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).toBeNull();
		} );

		it( 'should return null when date format is invalid', async () => {
			const item: UnparseRecordItem = {
				aid: 123456801,
				bvId: 'BV1xx411c7mP',
				title: '【机皇录播】2024/01/15 艾尔登法环',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).toBeNull();
		} );

		it( 'should filter out empty game names after cleaning', async () => {
			const item: UnparseRecordItem = {
				aid: 123456802,
				bvId: 'BV1xx411c7mQ',
				title: '【机皇录播】2024-01-15 +++',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).toBeNull();
		} );
	} );

	describe( 'Mr.Quin parser (uid: 15810)', () => {
		let parser: IParseItem;

		beforeEach( () => {
			parser = handleParseMapper.find( item => item.uid === 15810 )!;
		} );

		it( 'should parse title with 直播录像 suffix', async () => {
			const item: UnparseRecordItem = {
				aid: 123456803,
				bvId: 'BV1xx411c7mR',
				title: '【Quin】艾尔登法环直播录像',
				publishTime: 1705312800,
				liveDuration: 7200,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.liver ).toBe( 'Mr.Quin' );
			expect( result?.playGame ).toEqual( [ '艾尔登法环' ] );
			expect( result?.liveTime ).toBe( 1705312800 ); // Mr.Quin uses seconds directly
		} );

		it( 'should parse title with 直播实况 suffix', async () => {
			const item: UnparseRecordItem = {
				aid: 123456804,
				bvId: 'BV1xx411c7mS',
				title: '【Mr.Quin】黑暗之魂3直播实况',
				publishTime: 1705312800,
				liveDuration: 7200,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			// Note: The regex captures "直播" as part of the game name
			expect( result?.playGame ).toEqual( [ '黑暗之魂3直播' ] );
		} );

		it( 'should parse title without suffix (fallback pattern)', async () => {
			const item: UnparseRecordItem = {
				aid: 123456805,
				bvId: 'BV1xx411c7mT',
				title: '【Mr.Quin X 鱼炒剩饭】怪物猎人',
				publishTime: 1705312800,
				liveDuration: 7200,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.playGame ).toEqual( [ '怪物猎人' ] );
		} );

		it( 'should parse multiple games separated by plus', async () => {
			const item: UnparseRecordItem = {
				aid: 123456806,
				bvId: 'BV1xx411c7mU',
				title: '【Quin】艾尔登法环+只狼 直播录像',
				publishTime: 1705312800,
				liveDuration: 10800,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.playGame ).toEqual( [ '艾尔登法环', '只狼' ] );
		} );

		it( 'should parse multiple games separated by ampersand', async () => {
			const item: UnparseRecordItem = {
				aid: 123456807,
				bvId: 'BV1xx411c7mV',
				title: '【Mr.Quin】艾尔登法环&只狼直播实况',
				publishTime: 1705312800,
				liveDuration: 10800,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			// Note: The regex captures "直播" as part of the second game name
			expect( result?.playGame ).toEqual( [ '艾尔登法环', '只狼直播' ] );
		} );

		it( 'should parse title with nested brackets using fallback pattern', async () => {
			const item: UnparseRecordItem = {
				aid: 123456808,
				bvId: 'BV1xx411c7mW',
				title: '【Quin】艾尔登法环 直播录像',
				publishTime: 1705312800,
				liveDuration: 7200,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.playGame ).toEqual( [ '艾尔登法环' ] );
		} );

		it( 'should return null when game name not matched', async () => {
			const item: UnparseRecordItem = {
				aid: 123456809,
				bvId: 'BV1xx411c7mX',
				title: '普通视频标题，没有游戏信息',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).toBeNull();
		} );

		it( 'should return object with empty playGame when all game names are empty', async () => {
			const item: UnparseRecordItem = {
				aid: 123456810,
				bvId: 'BV1xx411c7mY',
				title: '【Quin】++ 直播录像',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.playGame ).toEqual( [] );
		} );

		it( 'should use publishTime as liveTime (seconds)', async () => {
			const item: UnparseRecordItem = {
				aid: 123456811,
				bvId: 'BV1xx411c7mZ',
				title: '【Quin】艾尔登法环 直播录像',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result?.liveTime ).toBe( 1705312800 ); // Mr.Quin parser uses seconds directly
		} );
	} );

	describe( '勾檀Mayumi parser (uid: 690608693)', () => {
		let parser: IParseItem;

		beforeEach( () => {
			parser = handleParseMapper.find( item => item.uid === 690608693 )!;
		} );

		it( 'should parse title with game info', async () => {
			const item: UnparseRecordItem = {
				aid: 123456812,
				bvId: 'BV1xx411c7na',
				title: '【直播回放】2024-01-15【艾尔登法环】勾檀Mayumi',
				publishTime: 1705312800,
				liveDuration: 7200,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.liver ).toBe( '勾檀Mayumi' );
			expect( result?.playGame ).toEqual( [ '艾尔登法环' ] );
		} );

		it( 'should parse title without game and use 杂谈 as default', async () => {
			const item: UnparseRecordItem = {
				aid: 123456813,
				bvId: 'BV1xx411c7nb',
				title: '【直播回放】2024-01-15 勾檀Mayumi',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.playGame ).toEqual( [ '杂谈' ] );
		} );

		it( 'should parse multiple games separated by plus', async () => {
			const item: UnparseRecordItem = {
				aid: 123456814,
				bvId: 'BV1xx411c7nc',
				title: '【直播回放】2024-01-15【艾尔登法环+只狼+黑暗之魂】勾檀Mayumi',
				publishTime: 1705312800,
				liveDuration: 10800,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.playGame ).toEqual( [ '艾尔登法环', '只狼', '黑暗之魂' ] );
		} );

		it( 'should trim whitespace from game names', async () => {
			const item: UnparseRecordItem = {
				aid: 123456815,
				bvId: 'BV1xx411c7nd',
				title: '【直播回放】2024-01-15【艾尔登法环 + 只狼】勾檀Mayumi',
				publishTime: 1705312800,
				liveDuration: 7200,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.playGame ).toEqual( [ '艾尔登法环', '只狼' ] );
		} );

		it( 'should return null when title does not contain 直播回放 prefix', async () => {
			const item: UnparseRecordItem = {
				aid: 123456816,
				bvId: 'BV1xx411c7ne',
				title: '普通视频标题 勾檀Mayumi',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).toBeNull();
		} );

		it( 'should handle different date formats', async () => {
			const item: UnparseRecordItem = {
				aid: 123456817,
				bvId: 'BV1xx411c7nf',
				title: '【直播回放】2024-1-5【只狼】勾檀Mayumi',
				publishTime: 1705312800,
				liveDuration: 3600,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.playGame ).toEqual( [ '只狼' ] );
		} );

		it( 'should handle only first bracket group for games', async () => {
			const item: UnparseRecordItem = {
				aid: 123456818,
				bvId: 'BV1xx411c7ng',
				title: '【直播回放】2024-01-15【艾尔登法环】【其他信息】勾檀Mayumi',
				publishTime: 1705312800,
				liveDuration: 7200,
			};

			const result = await parser.onParse( item );

			expect( result ).not.toBeNull();
			expect( result?.playGame ).toEqual( [ '艾尔登法环' ] );
		} );
	} );
} );
