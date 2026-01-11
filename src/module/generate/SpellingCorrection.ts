import { cwd } from 'node:process';
import { resolve } from 'node:path';
import { readFileSync } from 'fs';

export class SpellingCorrection {
	private readonly spellingCorrectionMapper: Record<string, string>;
	
	constructor() {
		const spellingCorrectionFilePath = resolve( cwd(), 'config', 'SpellingCorrections.json' );
		const spellingCorrectionContent = readFileSync( spellingCorrectionFilePath, 'utf-8' );
		this.spellingCorrectionMapper = JSON.parse( spellingCorrectionContent );
	}
	
	private check( game: string ) {
		return Boolean( this.spellingCorrectionMapper[ game ] );
	}
	
	/**
	 * 纠正错误的游戏名, 返回正确的游戏名
	 */
	correct( game: string ): string {
		if ( !this.check( game ) ) {
			return game;
		}
		
		return this.spellingCorrectionMapper[ game ];
	}
}
