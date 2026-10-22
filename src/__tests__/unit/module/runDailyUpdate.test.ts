import mockFs from 'mock-fs';
import type { Browser } from 'playwright';
import { mountFs } from '../../helpers/mockFs';
import {
	formatFailureSummary,
	runDailyUpdate,
	shouldFailRun,
} from '../../../module/runDailyUpdate.ts';
import { ScraperHealthError } from '../../../scraper/playwrightStreamPages.ts';
import * as matchVideoListModule from '../../../module/matchData/matchVideoList.ts';
import * as generateMarkdownRecordModule from '../../../module/generateReadme/generateMarkdownRecord.ts';
import type { IParseItem } from '../../../module/matchData/handleParseMapper.ts';

const createRiskError = ( uid = 1 ) =>
	new ScraperHealthError( uid, 'upload', '接口返回错误码 -352: 风控校验失败', -352 );

const createItem = ( uid: number, userName: string ): IParseItem => ( {
	uid,
	userName,
	videoSourceType: 'upload',
	seriesId: undefined,
	onParse: jest.fn(),
} ) as unknown as IParseItem;

const fastOptions = { intervalMs: 0, riskControlBackoffMs: 0 };

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
		jest.spyOn( console, 'info' ).mockImplementation();
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
			.mockResolvedValueOnce( false )
			.mockRejectedValueOnce( new Error( 'boom' ) )
			.mockResolvedValueOnce( false );

		const result = await runDailyUpdate( items, fakeBrowser, fastOptions );

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

		await runDailyUpdate( items, fakeBrowser, fastOptions );

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

		const result = await runDailyUpdate( items, fakeBrowser, fastOptions );

		expect( result.failures ).toHaveLength( 1 );
		expect( result.failures[ 0 ] ).toMatchObject( { uid: 1, stage: 'generate' } );
	} );

	it('全部成功时没有失败记录', async () => {
		const items = [ createItem( 1, 'A' ), createItem( 2, 'B' ) ];

		jest.spyOn( matchVideoListModule, 'matchVideoList' ).mockResolvedValue( false );

		const result = await runDailyUpdate( items, fakeBrowser, fastOptions );

		expect( result.failures ).toEqual( [] );
		expect( generateMarkdownRecordModule.generateMarkdownRecord )
			.toHaveBeenCalledTimes( 2 );
	} );

	it('风控失败冷却后换新会话重试成功', async () => {
		const items = [ createItem( 1, 'A' ) ];

		jest.spyOn( matchVideoListModule, 'matchVideoList' )
			.mockRejectedValueOnce( createRiskError( 1 ) )
			.mockResolvedValueOnce( false );

		const result = await runDailyUpdate( items, fakeBrowser, fastOptions );

		expect( matchVideoListModule.matchVideoList ).toHaveBeenCalledTimes( 2 );
		expect( result.failures ).toEqual( [] );
	} );

	it('风控重试仍失败时保留失败记录', async () => {
		const items = [ createItem( 1, 'A' ) ];

		jest.spyOn( matchVideoListModule, 'matchVideoList' )
			.mockRejectedValueOnce( createRiskError( 1 ) )
			.mockRejectedValueOnce( createRiskError( 1 ) );

		const result = await runDailyUpdate( items, fakeBrowser, fastOptions );

		expect( matchVideoListModule.matchVideoList ).toHaveBeenCalledTimes( 2 );
		expect( result.failures ).toHaveLength( 1 );
		expect( result.failures[ 0 ] ).toMatchObject( { uid: 1, stage: 'collect' } );
	} );

	it('非风控错误不做重试', async () => {
		const items = [ createItem( 1, 'A' ) ];

		jest.spyOn( matchVideoListModule, 'matchVideoList' )
			.mockRejectedValueOnce( new Error( 'boom' ) );

		await runDailyUpdate( items, fakeBrowser, fastOptions );

		expect( matchVideoListModule.matchVideoList ).toHaveBeenCalledTimes( 1 );
	} );

	it('只重试风控失败的上传者', async () => {
		const items = [ createItem( 1, 'A' ), createItem( 2, 'B' ) ];

		jest.spyOn( matchVideoListModule, 'matchVideoList' )
			.mockRejectedValueOnce( new Error( 'boom' ) )
			.mockRejectedValueOnce( createRiskError( 2 ) )
			.mockResolvedValueOnce( false );

		const result = await runDailyUpdate( items, fakeBrowser, fastOptions );

		expect( matchVideoListModule.matchVideoList ).toHaveBeenCalledTimes( 3 );
		expect( result.failures ).toHaveLength( 1 );
		expect( result.failures[ 0 ] ).toMatchObject( { uid: 1, stage: 'collect' } );
	} );
} );

describe('shouldFailRun', () => {
	it('只有采集层失败时不算硬失败', () => {
		expect( shouldFailRun( [
			{ uid: 15810, userName: 'Mr.Quin', stage: 'collect', error: new Error( '-352' ) },
		] ) ).toBe( false );
	} );

	it('文档生成失败算硬失败', () => {
		expect( shouldFailRun( [
			{ uid: 15810, userName: 'Mr.Quin', stage: 'generate', error: new Error( 'boom' ) },
		] ) ).toBe( true );
	} );

	it('没有失败时不算硬失败', () => {
		expect( shouldFailRun( [] ) ).toBe( false );
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
