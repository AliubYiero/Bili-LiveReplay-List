import mockFs from 'mock-fs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import {
	listUsers,
	readUserRecords,
	saveAidRules
} from '../../../module/spellingEditor/recordsStorage';
import { SpellingEditorError } from '../../../module/spellingEditor/editorCommon';

const dataDir = join(cwd(), 'data');
const quinDir = join(dataDir, '15810');
const quinRecordPath = join(quinDir, 'Mr.Quin.record.json');
const quinAidPath = join(quinDir, 'Mr.Quin.aid.json');
const quinAidBackupPath = `${quinAidPath}.bak`;

const quinRecord = {
	cache: { uid: 15810, userName: 'Mr.Quin', aid: 117110453833348, timestamp: 1790764099780 },
	records: [
		{
			aid: 566724,
			bvId: 'BV1os411Z7Du',
			publishTime: 1368491641000,
			liveDuration: 2486,
			title: '【Mr.Quin】生化奇兵:无限 第一集',
			liveTime: 1368491641000,
			playGame: ['生化奇兵:无限 第一集'],
			liver: 'Mr.Quin'
		}
	]
};

const quinAid = { '566724': ['生化奇兵:无限'], '582628': [] };

/**
 * 按给定的 data/ 内容建立 mock 文件系统
 * 默认覆盖三种用户形态：两类文件都全、缺 aid.json、缺 record.json
 * 另外在 data/ 根下放一个同名后缀的文件，确认扫描不会把它当成用户目录
 */
function mountFs( overrides: Record<string, unknown> = {} ): void {
	mockFs( {
		data: {
			'SpellingCorrections.json': '{}',
			'15810': {
				'Mr.Quin.record.json': JSON.stringify( quinRecord ),
				'Mr.Quin.aid.json': JSON.stringify( quinAid, null, '\t' )
			},
			'245335': {
				'胧黑.record.json': JSON.stringify( { cache: {}, records: [] } )
			},
			'690608693': {
				'勾檀Mayumi.aid.json': JSON.stringify( {} )
			},
			notanuid: {
				'a.record.json': '{}',
				'a.aid.json': '{}'
			},
			...overrides
		}
	} );
}

function readQuinAid(): unknown {
	return JSON.parse( readFileSync( quinAidPath, 'utf-8' ) );
}

/** 断言抛出的 SpellingEditorError 类型 */
async function expectErrorType( run: () => Promise<unknown>, type: string ): Promise<void> {
	try {
		await run();
		throw new Error( 'should have thrown' );
	} catch ( error ) {
		expect( error ).toBeInstanceOf( SpellingEditorError );
		expect( ( error as SpellingEditorError ).type ).toBe( type );
	}
}

describe('recordsStorage', () => {
	afterEach(() => {
		mockFs.restore();
	});

	describe('listUsers', () => {
		it('only lists users that have both record.json and aid.json', () => {
			mountFs();

			expect( listUsers() ).toEqual( [{ uid: '15810', userName: 'Mr.Quin' }] );
		});

		it('skips non-directory entries at the data root', () => {
			mountFs();

			// SpellingCorrections.json 在 data/ 根下，不是用户目录
			expect( listUsers().some( user => user.userName.includes( 'Spelling' ) ) ).toBe( false );
		});

		it('skips directories that are not numeric UIDs', () => {
			mountFs();

			expect( listUsers() ).toHaveLength( 1 );
		});

		it('lists every paired user sorted by uid', () => {
			mountFs( {
				'245335': {
					'胧黑.record.json': JSON.stringify( { cache: {}, records: [] } ),
					'胧黑.aid.json': JSON.stringify( {} )
				}
			} );

			expect( listUsers() ).toEqual( [
				{ uid: '15810', userName: 'Mr.Quin' },
				{ uid: '245335', userName: '胧黑' }
			] );
		});

		it('returns an empty list when data/ does not exist', () => {
			mockFs( {} );

			expect( listUsers() ).toEqual( [] );
		});
	});

	describe('readUserRecords', () => {
		it('returns both the record file and the aid mapping', () => {
			mountFs();

			const result = readUserRecords( '15810', 'Mr.Quin' );

			expect( result.record.records ).toHaveLength( 1 );
			expect( result.record.records[ 0 ].aid ).toBe( 566724 );
			expect( result.aid ).toEqual( quinAid );
			expect( existsSync( quinRecordPath ) ).toBe( true );
		});

		it('throws USER_NOT_FOUND when record.json is missing', async () => {
			mountFs();

			// 690608693 只有 aid.json
			await expectErrorType( async () => readUserRecords( '690608693', '勾檀Mayumi' ), 'USER_NOT_FOUND' );
		});

		it('throws AID_FILE_NOT_FOUND when aid.json is missing', async () => {
			mountFs();

			// 245335 只有 record.json
			await expectErrorType( async () => readUserRecords( '245335', '胧黑' ), 'AID_FILE_NOT_FOUND' );
		});

		it('throws INTERNAL_ERROR when record.json is not valid JSON', async () => {
			mountFs( { '15810': { 'Mr.Quin.record.json': '{ not json', 'Mr.Quin.aid.json': '{}' } } );

			await expectErrorType( async () => readUserRecords( '15810', 'Mr.Quin' ), 'INTERNAL_ERROR' );
		});

		it('throws INTERNAL_ERROR when record.json has no records array', async () => {
			mountFs( { '15810': { 'Mr.Quin.record.json': '{"cache":{}}', 'Mr.Quin.aid.json': '{}' } } );

			await expectErrorType( async () => readUserRecords( '15810', 'Mr.Quin' ), 'INTERNAL_ERROR' );
		});

		it('throws INTERNAL_ERROR when aid.json has a non-array value', async () => {
			mountFs( { '15810': { 'Mr.Quin.record.json': JSON.stringify( quinRecord ), 'Mr.Quin.aid.json': '{"1":"x"}' } } );

			await expectErrorType( async () => readUserRecords( '15810', 'Mr.Quin' ), 'INTERNAL_ERROR' );
		});

		it('does not create the user directory when it is missing', () => {
			mountFs();

			try {
				readUserRecords( '99999', 'Nobody' );
			} catch ( error ) {
				// 预期抛 USER_NOT_FOUND
			}

			expect( existsSync( join( dataDir, '99999' ) ) ).toBe( false );
		});
	});

	describe('saveAidRules', () => {
		it('writes the given rules', async () => {
			mountFs();

			await saveAidRules( '15810', 'Mr.Quin', { '566724': ['生化奇兵：无限'] } );

			expect( readQuinAid() ).toEqual( { '566724': ['生化奇兵：无限'], '582628': [] } );
		});

		it('keeps keys that were added to the file after the page loaded', async () => {
			mountFs();

			// 模拟编辑器加载后，主程序 AidMapperStore 往 aid.json 补入新 key
			const onDisk = { ...quinAid, '999999': [] };
			mockFs( {
				data: {
					'15810': {
						'Mr.Quin.record.json': JSON.stringify( quinRecord ),
						'Mr.Quin.aid.json': JSON.stringify( onDisk, null, '\t' )
					}
				}
			} );

			await saveAidRules( '15810', 'Mr.Quin', { '566724': ['生化奇兵：无限'] } );

			expect( readQuinAid() ).toEqual( { '566724': ['生化奇兵：无限'], '582628': [], '999999': [] } );
		});

		it('creates a key that did not exist before', async () => {
			mountFs();

			await saveAidRules( '15810', 'Mr.Quin', { '777777': ['杂谈'] } );

			expect( readQuinAid() ).toEqual( { '566724': ['生化奇兵:无限'], '582628': [], '777777': ['杂谈'] } );
		});

		it('keeps a key as an empty array when all tags were removed', async () => {
			mountFs();

			await saveAidRules( '15810', 'Mr.Quin', { '566724': [] } );

			expect( readQuinAid() ).toEqual( { '566724': [], '582628': [] } );
		});

		it('backs up the previous content to .bak before writing', async () => {
			mountFs();
			const before = readFileSync( quinAidPath, 'utf-8' );

			await saveAidRules( '15810', 'Mr.Quin', { '566724': ['生化奇兵：无限'] } );

			expect( existsSync( quinAidBackupPath ) ).toBe( true );
			expect( readFileSync( quinAidBackupPath, 'utf-8' ) ).toBe( before );
		});

		it('writes with tab indentation, matching AidMapperStore', async () => {
			mountFs();

			await saveAidRules( '15810', 'Mr.Quin', { '566724': ['生化奇兵：无限'] } );

			expect( readFileSync( quinAidPath, 'utf-8' ) ).toContain( '\n\t"566724": [' );
		});

		it('dedupes tags before writing', async () => {
			mountFs();

			await saveAidRules( '15810', 'Mr.Quin', { '566724': ['dota2', 'dota2'] } );

			expect( readQuinAid() ).toEqual( { '566724': ['dota2'], '582628': [] } );
		});

		it('rejects an empty tag and keeps the file unchanged', async () => {
			mountFs();
			const before = readFileSync( quinAidPath, 'utf-8' );

			await expectErrorType(
				async () => saveAidRules( '15810', 'Mr.Quin', { '566724': [''] } ),
				'VALIDATION_ERROR'
			);

			expect( readFileSync( quinAidPath, 'utf-8' ) ).toBe( before );
			expect( existsSync( quinAidBackupPath ) ).toBe( false );
		});

		it('rejects a non-array value and keeps the file unchanged', async () => {
			mountFs();
			const before = readFileSync( quinAidPath, 'utf-8' );

			await expectErrorType(
				async () => saveAidRules( '15810', 'Mr.Quin', { '566724': 'dota2' } as never ),
				'VALIDATION_ERROR'
			);

			expect( readFileSync( quinAidPath, 'utf-8' ) ).toBe( before );
		});

		it('throws AID_FILE_NOT_FOUND when aid.json is missing', async () => {
			mountFs();

			// 245335 只有 record.json
			await expectErrorType(
				async () => saveAidRules( '245335', '胧黑', {} ),
				'AID_FILE_NOT_FOUND'
			);
		});

		it('returns LOCKED when another process holds the lock', async () => {
			mockFs( {
				data: {
					'15810': {
						'Mr.Quin.record.json': JSON.stringify( quinRecord ),
						'Mr.Quin.aid.json': JSON.stringify( quinAid, null, '\t' ),
						'Mr.Quin.aid.json.lock': {}
					}
				}
			} );

			await expectErrorType(
				async () => saveAidRules( '15810', 'Mr.Quin', { '566724': ['x'] } ),
				'LOCKED'
			);
		});
	});
});
