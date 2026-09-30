import mockFs from 'mock-fs';
import { readdirSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import { aggregateUserGames, listRecordUids } from '../../../module/spellingEditor/gamesAggregator';
import { SpellingEditorError } from '../../../module/spellingEditor/editorCommon';
import type { SpellingCorrectionConfig } from '../../../interface/ISpellingCorrection';

const dataDir = join( cwd(), 'data' );

/** mock-fs 的 data/ 描述：目录名 → 目录内容，或直接是文件内容（如根下的 README） */
type MockFiles = Record<string, Record<string, string> | string>;

function baseConfig( config: Partial<SpellingCorrectionConfig> = {} ): SpellingCorrectionConfig {
	return {
		version: '2.0',
		global: { rules: [] },
		uidRules: {},
		...config
	};
}

/** 构造一个只带 records[].playGame 的最小 record.json */
function recordFile( playGameList: unknown[] ): string {
	return JSON.stringify( {
		cache: { uid: 1, userName: 'test', aid: 1, timestamp: 0 },
		records: playGameList.map( ( playGame, index ) => ( {
			aid: index,
			bvId: `BV${ index }`,
			publishTime: 0,
			liveDuration: 0,
			title: `t${ index }`,
			liveTime: 0,
			playGame,
			liver: 'test'
		} ) )
	} );
}

function mountFs( files: MockFiles, config: SpellingCorrectionConfig = baseConfig() ): void {
	const data: MockFiles = {
		'SpellingCorrections.json': JSON.stringify( config, null, '\t' )
	};

	for ( const uid of Object.keys( files ) ) {
		data[ uid ] = files[ uid ];
	}

	mockFs( { data } );
}

/** 取出某个 uid 的全部原始名，按接口返回的顺序 */
function rawNames( uid: string ): string[] {
	return aggregateUserGames( uid ).games.map( game => game.rawName );
}

describe('gamesAggregator', () => {
	afterEach( () => {
		mockFs.restore();
	} );

	describe('listRecordUids', () => {
		it('只列出存在 record.json 的数字目录', () => {
			mountFs( {
				'15810': { 'Mr.Quin.record.json': recordFile( [ [ 'A' ] ] ) },
				'245335': { '胧黑.record.json': recordFile( [ [ 'B' ] ] ) },
				// 只有 aid.json，没有录播数据
				'99999': { 'x.aid.json': '{}' },
				// 非数字目录 / 根下的散落文件都不算用户
				'not-a-uid': { 'y.record.json': recordFile( [ [ 'C' ] ] ) },
				'README.md': 'hi'
			} );

			expect( listRecordUids() ).toEqual( [ '15810', '245335' ] );
		} );

		it('不要求 aid.json 存在', () => {
			mountFs( { '15810': { 'Mr.Quin.record.json': recordFile( [ [ 'A' ] ] ) } } );

			expect( listRecordUids() ).toEqual( [ '15810' ] );
		} );

		it('按数字大小而不是字典序排序', () => {
			mountFs( {
				'245335': { 'a.record.json': recordFile( [ [ 'A' ] ] ) },
				'15810': { 'b.record.json': recordFile( [ [ 'B' ] ] ) },
				'1400350754': { 'c.record.json': recordFile( [ [ 'C' ] ] ) }
			} );

			expect( listRecordUids() ).toEqual( [ '15810', '245335', '1400350754' ] );
		} );

		it('data/ 不存在时返回空数组', () => {
			mockFs( {} );

			expect( listRecordUids() ).toEqual( [] );
		} );
	} );

	describe('aggregateUserGames', () => {
		it('去重并统计出现次数', () => {
			mountFs( {
				'15810': { 'Mr.Quin.record.json': recordFile( [ [ 'A', 'B' ], [ 'B', 'C' ], [ 'B' ] ] ) }
			} );

			const games = aggregateUserGames( '15810' ).games;

			expect( games.map( game => game.rawName ) ).toEqual( [ 'B', 'C', 'A' ] );
			expect( games[ 0 ].occurrences ).toBe( 3 );
			expect( games[ 1 ].occurrences ).toBe( 1 );
			expect( games[ 2 ].occurrences ).toBe( 1 );
		} );

		it('按最后一次出现的序号降序排列', () => {
			mountFs( {
				'15810': { 'Mr.Quin.record.json': recordFile( [ [ 'A', 'B', 'C' ], [ 'C' ] ] ) }
			} );

			// C 最后出现在下标 3，B 在 1，A 在 0
			expect( rawNames( '15810' ) ).toEqual( [ 'C', 'B', 'A' ] );
			expect( aggregateUserGames( '15810' ).games[ 0 ].lastIndex ).toBe( 3 );
		} );

		it('合并同一 uid 目录下的多个 record.json，按文件名顺序遍历', () => {
			mountFs( {
				'15810': {
					'a.record.json': recordFile( [ [ 'A' ] ] ),
					'b.record.json': recordFile( [ [ 'B' ] ] )
				}
			} );

			// a 先于 b 遍历，因此 B 的 lastIndex 更大
			expect( rawNames( '15810' ) ).toEqual( [ 'B', 'A' ] );
		} );

		it('跳过非数组的 playGame 与空字符串', () => {
			mountFs( {
				'15810': {
					'Mr.Quin.record.json': recordFile( [ 'not-an-array', [ '', 'A' ], 42 ] )
				}
			} );

			expect( rawNames( '15810' ) ).toEqual( [ 'A' ] );
		} );

		it('没有任何规则时 finalSource 为 none，finalName 等于原始名', () => {
			mountFs( { '15810': { 'Mr.Quin.record.json': recordFile( [ [ 'A' ] ] ) } } );

			const game = aggregateUserGames( '15810' ).games[ 0 ];

			expect( game.finalName ).toBe( 'A' );
			expect( game.finalSource ).toBe( 'none' );
			expect( game.uidRule ).toBeNull();
			expect( game.globalRule ).toBeNull();
			expect( game.shadowedGlobalTo ).toBeNull();
		} );

		it('只有 UID 规则命中时 finalSource 为 uid', () => {
			mountFs(
				{ '15810': { 'Mr.Quin.record.json': recordFile( [ [ 'data2' ] ] ) } },
				baseConfig( { uidRules: { '15810': { rules: [ { from: 'data2', to: 'dota2' } ] } } } )
			);

			const game = aggregateUserGames( '15810' ).games[ 0 ];

			expect( game.finalName ).toBe( 'dota2' );
			expect( game.finalSource ).toBe( 'uid' );
			expect( game.uidRule ).toEqual( { to: 'dota2' } );
			expect( game.globalRule ).toBeNull();
		} );

		it('只有全局规则命中时 finalSource 为 global', () => {
			mountFs(
				{ '15810': { 'Mr.Quin.record.json': recordFile( [ [ 'data2' ] ] ) } },
				baseConfig( { global: { rules: [ { from: 'data2', to: 'dota2' } ] } } )
			);

			const game = aggregateUserGames( '15810' ).games[ 0 ];

			expect( game.finalName ).toBe( 'dota2' );
			expect( game.finalSource ).toBe( 'global' );
			expect( game.uidRule ).toBeNull();
			expect( game.globalRule ).toEqual( { to: 'dota2' } );
		} );

		it('UID 命中后仍会被全局二次纠正，finalSource 为 uid+global', () => {
			// 主程序 SpellingCorrection.correct() 是两步串联：
			// data2 --uid--> dota2 --global--> DOTA2
			mountFs(
				{ '15810': { 'Mr.Quin.record.json': recordFile( [ [ 'data2' ] ] ) } },
				baseConfig( {
					global: { rules: [ { from: 'dota2', to: 'DOTA2' } ] },
					uidRules: { '15810': { rules: [ { from: 'data2', to: 'dota2' } ] } }
				} )
			);

			const game = aggregateUserGames( '15810' ).games[ 0 ];

			expect( game.finalName ).toBe( 'DOTA2' );
			expect( game.finalSource ).toBe( 'uid+global' );
			expect( game.uidRule ).toEqual( { to: 'dota2' } );
			expect( game.globalRule ).toEqual( { to: 'DOTA2' } );
		} );

		it('UID 规则遮挡了同名全局规则时把全局值放进 shadowedGlobalTo', () => {
			mountFs(
				{ '15810': { 'Mr.Quin.record.json': recordFile( [ [ '塞尔达' ] ] ) } },
				baseConfig( {
					global: { rules: [ { from: '塞尔达', to: '旷野之息' } ] },
					uidRules: { '15810': { rules: [ { from: '塞尔达', to: '王国之泪' } ] } }
				} )
			);

			const game = aggregateUserGames( '15810' ).games[ 0 ];

			expect( game.finalName ).toBe( '王国之泪' );
			expect( game.finalSource ).toBe( 'uid' );
			expect( game.globalRule ).toBeNull();
			// 全局对原始名的纠正结果，仅供 tooltip
			expect( game.shadowedGlobalTo ).toBe( '旷野之息' );
		} );

		it('UID 规则是恒等映射时不算遮挡，全局照常生效', () => {
			mountFs(
				{ '15810': { 'Mr.Quin.record.json': recordFile( [ [ '塞尔达' ] ] ) } },
				baseConfig( {
					global: { rules: [ { from: '塞尔达', to: '旷野之息' } ] },
					uidRules: { '15810': { rules: [ { from: '塞尔达', to: '塞尔达' } ] } }
				} )
			);

			const game = aggregateUserGames( '15810' ).games[ 0 ];

			expect( game.finalName ).toBe( '旷野之息' );
			expect( game.finalSource ).toBe( 'uid+global' );
			expect( game.shadowedGlobalTo ).toBeNull();
		} );

		it('只有当前 uid 的规则参与计算', () => {
			mountFs(
				{ '15810': { 'Mr.Quin.record.json': recordFile( [ [ 'A' ] ] ) } },
				baseConfig( { uidRules: { '245335': { rules: [ { from: 'A', to: 'X' } ] } } } )
			);

			const game = aggregateUserGames( '15810' ).games[ 0 ];

			expect( game.finalName ).toBe( 'A' );
			expect( game.finalSource ).toBe( 'none' );
		} );

		it('同一 from 重复出现时后者胜出，与主程序的 Map 构造一致', () => {
			mountFs(
				{ '15810': { 'Mr.Quin.record.json': recordFile( [ [ 'A' ] ] ) } },
				baseConfig( {
					uidRules: { '15810': { rules: [ { from: 'A', to: 'x' }, { from: 'A', to: 'y' } ] } }
				} )
			);

			expect( aggregateUserGames( '15810' ).games[ 0 ].finalName ).toBe( 'y' );
		} );

		it('返回该 uid 的完整规则，包含数据中未出现的孤儿规则', () => {
			mountFs(
				{ '15810': { 'Mr.Quin.record.json': recordFile( [ [ 'A' ] ] ) } },
				baseConfig( {
					uidRules: {
						'15810': {
							rules: [ { from: '孤儿', to: 'x' }, { from: 'A', to: 'a2' } ]
						}
					}
				} )
			);

			const result = aggregateUserGames( '15810' );

			// 孤儿规则不产生表格行
			expect( result.games.map( game => game.rawName ) ).toEqual( [ 'A' ] );
			// 但必须原样返回，前端整页提交时才不会把它删掉
			expect( result.rules ).toEqual( [ { from: '孤儿', to: 'x' }, { from: 'A', to: 'a2' } ] );
		} );

		it('返回全局规则映射供前端就地重算', () => {
			mountFs(
				{ '15810': { 'Mr.Quin.record.json': recordFile( [ [ 'A' ] ] ) } },
				baseConfig( { global: { rules: [ { from: 'A', to: 'a2' }, { from: 'B', to: 'b2' } ] } } )
			);

			expect( aggregateUserGames( '15810' ).globalRules ).toEqual( { A: 'a2', B: 'b2' } );
		} );

		it('uid 没有数据目录时抛 USER_NOT_FOUND', () => {
			mountFs( { '15810': { 'Mr.Quin.record.json': recordFile( [ [ 'A' ] ] ) } } );

			try {
				aggregateUserGames( '99999' );
				throw new Error( 'should have thrown' );
			} catch ( error ) {
				expect( ( error as SpellingEditorError ).type ).toBe( 'USER_NOT_FOUND' );
			}
		} );

		it('uid 目录下没有 record.json 时抛 USER_NOT_FOUND，且不创建新目录', () => {
			mountFs( { '15810': { 'Mr.Quin.aid.json': '{}' } } );
			const before = readdirSync( dataDir ).slice().sort();

			try {
				aggregateUserGames( '15810' );
				throw new Error( 'should have thrown' );
			} catch ( error ) {
				expect( ( error as SpellingEditorError ).type ).toBe( 'USER_NOT_FOUND' );
			}

			expect( readdirSync( dataDir ).slice().sort() ).toEqual( before );
		} );

		it('record.json 不是合法 JSON 时抛 INTERNAL_ERROR', () => {
			mountFs( { '15810': { 'Mr.Quin.record.json': '{ not json' } } );

			try {
				aggregateUserGames( '15810' );
				throw new Error( 'should have thrown' );
			} catch ( error ) {
				expect( ( error as SpellingEditorError ).type ).toBe( 'INTERNAL_ERROR' );
			}
		} );
	} );
} );
