import mockFs from 'mock-fs';
import type { Browser } from 'playwright';
import { mountFs } from '../../helpers/mockFs';
import {
	formatFailureSummary,
	runDailyUpdate,
} from '../../../module/runDailyUpdate.ts';
import * as matchVideoListModule from '../../../module/matchData/matchVideoList.ts';
import * as generateMarkdownRecordModule from '../../../module/generateReadme/generateMarkdownRecord.ts';
import type { IParseItem } from '../../../module/matchData/handleParseMapper.ts';

const createItem = ( uid: number, userName: string ): IParseItem => ( {
	uid,
	userName,
	videoSourceType: 'upload',
	seriesId: undefined,
	onParse: jest.fn(),
} ) as unknown as IParseItem;

describe('runDailyUpdate', () => {
	const fakeBrowser = {} as Browser;

	beforeEach( () => {
		mountFs( {
			'data': {
				'1': {},
				'2': {},
				'3': {},
			},
		} );
		jest.clearAllMocks();
		jest.spyOn( console, 'error' ).mockImplementation();
		jest.spyOn( console, 'warn' ).mockImplementation();
		jest.spyOn( generateMarkdownRecordModule, 'generateMarkdownRecord' )
			.mockImplementation();
	} );

	afterEach( () => {
		mockFs.restore();
		jest.restoreAllMocks();
	} );

	it('单个上传者采集失败不影响其余上传者', async () => {
		const items = [ createItem( 1, 'A' ), createItem( 2, 'B' ), createItem( 3, 'C' ) ];

		jest.spyOn( matchVideoListModule, 'matchVideoList' )
			.mockResolvedValue( false )
			.mockResolvedValueOnce( false )
			.mockRejectedValueOnce( new Error( '-352 风控校验失败' ) )
			.mockResolvedValueOnce( false );

		const result = await runDailyUpdate( items, fakeBrowser, 0 );

		expect( result.total ).toBe( 3 );
		expect( result.failures ).toHaveLength( 1 );
		expect( result.failures[ 0 ] ).toMatchObject( {
			uid: 2,
			userName: 'B',
			stage: 'collect',
		} );
		expect( matchVideoListModule.matchVideoList ).toHaveBeenCalledTimes( 3 );
	} );

	it('采集失败后仍为每个上传者重新生成文档', async () => {
		const items = [ createItem( 1, 'A' ), createItem( 2, 'B' ) ];

		jest.spyOn( matchVideoListModule, 'matchVideoList' )
			.mockRejectedValueOnce( new Error( 'boom' ) )
			.mockResolvedValueOnce( false );

		await runDailyUpdate( items, fakeBrowser, 0 );

		expect( generateMarkdownRecordModule.generateMarkdownRecord )
			.toHaveBeenCalledTimes( 2 );
	} );

	it('文档生成失败被单独记为 generate 阶段', async () => {
		const items = [ createItem( 1, 'A' ) ];

		jest.spyOn( matchVideoListModule, 'matchVideoList' ).mockResolvedValue( false );
		jest.spyOn( generateMarkdownRecordModule, 'generateMarkdownRecord' )
			.mockImplementationOnce( () => {
				throw new Error( 'write failed' );
			} );

		const result = await runDailyUpdate( items, fakeBrowser, 0 );

		expect( result.failures ).toHaveLength( 1 );
		expect( result.failures[ 0 ] ).toMatchObject( { uid: 1, stage: 'generate' } );
	} );

	it('全部成功时没有失败记录', async () => {
		const items = [ createItem( 1, 'A' ), createItem( 2, 'B' ) ];

		jest.spyOn( matchVideoListModule, 'matchVideoList' ).mockResolvedValue( false );

		const result = await runDailyUpdate( items, fakeBrowser, 0 );

		expect( result.failures ).toEqual( [] );
		expect( generateMarkdownRecordModule.generateMarkdownRecord )
			.toHaveBeenCalledTimes( 2 );
	} );
} );

describe('formatFailureSummary', () => {
	it('列出每个失败环节的 uid、名称与阶段', () => {
		const summary = formatFailureSummary( [
			{ uid: 1400350754, userName: '自行车二层', stage: 'collect', error: new Error( '-352 风控校验失败' ) },
			{ uid: 15810, userName: 'Mr.Quin', stage: 'generate', error: 'boom' },
		] );

		expect( summary ).toContain( '本次运行有 2 个环节失败' );
		expect( summary ).toContain( '自行车二层(uid:1400350754) [采集]: -352 风控校验失败' );
		expect( summary ).toContain( 'Mr.Quin(uid:15810) [生成文档]: boom' );
	} );
} );
