import { cwd } from 'node:process';
import { resolve } from 'node:path';
import { readFileSync } from 'fs';
import { validateSpellingCorrection } from '../../utils/configValidator.ts';

export class SpellingCorrection {
	private readonly spellingCorrectionMapper: Record<string, string>;
	
	constructor() {
		try {
			const spellingCorrectionFilePath = resolve( cwd(), 'config', 'SpellingCorrections.json' );
			const spellingCorrectionContent = readFileSync( spellingCorrectionFilePath, 'utf-8' );
			const parsed = JSON.parse( spellingCorrectionContent );
			this.spellingCorrectionMapper = validateSpellingCorrection( parsed );
		} catch (error) {
			console.warn( '加载拼写纠正配置失败，使用空配置:', error );
			this.spellingCorrectionMapper = {};
		}
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
	
	private check( game: string ) {
		return Boolean( this.spellingCorrectionMapper[ game ] );
	}
}
