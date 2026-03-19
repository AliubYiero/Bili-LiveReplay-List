import { existsSync, readFileSync, writeFileSync } from 'fs';
import { DataPathManager } from '../utils/DataPathManager.ts';

type IAidMapper = Record<string, string[]>

export class AidMapperStore {
	private readonly aidMapperFilePath: string;
	private aidMapper: IAidMapper;
	
	constructor(
		private uid: number,
		private userName: string = '',
	) {
		// 使用新路径（如果提供了 userName），否则回退到旧路径
		this.aidMapperFilePath = userName
			? DataPathManager.getAidFilePath(uid, userName)
			: DataPathManager.getLegacyAidPath(uid);
		
		// 如果使用新路径，确保目录存在
		if (userName) {
			DataPathManager.getUserDataDir(uid);
		}
		
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
