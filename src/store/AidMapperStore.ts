import { existsSync, readFileSync, writeFileSync } from 'fs';
import { DataPathManager } from '../utils/DataPathManager.ts';

type IAidMapper = Record<string, string[]>

export class AidMapperStore {
	private readonly aidMapperFilePath: string;
	private aidMapper: IAidMapper;
	
	constructor(
		private uid: number,
		private userName: string,
	) {
		const paths = DataPathManager.getUserFilePaths(uid, userName);
		this.aidMapperFilePath = paths.aidPath;
		
		// 目录已由 getUserDataDir 自动创建，无需额外处理
		this.aidMapper = this.get();
	}
	
	/**
	 * 更新空数组
	 */
	update( aidList: string[] ) {
		aidList.forEach( aid => {
			if ( this.aidMapper[ aid ] ) {
				return;
			}
			
			this.aidMapper[ aid ] = [];
		} );
		this.set( this.aidMapper );
	}
	
	getGameList( aid: string | number ): string[] | undefined {
		return this.aidMapper[ aid.toString() ];
	}
	
	private get(): IAidMapper {
		if ( !existsSync( this.aidMapperFilePath ) ) {
			return {};
		}
		
		return JSON.parse( readFileSync( this.aidMapperFilePath, 'utf-8' ) );
	}
	
	private set( aidMapper: IAidMapper ) {
		writeFileSync( this.aidMapperFilePath, JSON.stringify( aidMapper, null, '\t' ), 'utf-8' );
	}
}
