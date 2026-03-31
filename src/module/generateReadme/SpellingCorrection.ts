import { readFileSync } from 'fs';
import { validateSpellingCorrectionV2 } from '../../utils/configValidator.ts';
import { DataPathManager } from '../../utils/DataPathManager.ts';
import type { SpellingCorrectionConfig } from '../../interface/ISpellingCorrection.ts';

export class SpellingCorrection {
	private globalRules: Map<string, string>;
	private uidRules: Map<number, Map<string, string>>;

	constructor() {
		this.globalRules = new Map();
		this.uidRules = new Map();
		
		try {
			const spellingCorrectionFilePath = DataPathManager.getSpellingCorrectionPath();
			const spellingCorrectionContent = readFileSync( spellingCorrectionFilePath, 'utf-8' );
			const parsed = JSON.parse( spellingCorrectionContent );
			
			const validationResult = validateSpellingCorrectionV2( parsed );
			
			if ( validationResult.success ) {
				this.loadConfig( validationResult.data );
			} else {
				console.warn( '拼写纠正配置文件格式错误（需要 V2 格式），请运行迁移脚本: npm run migrate:spelling' );
				console.warn( '验证错误:', validationResult.error.message );
			}
		} catch (error) {
			console.warn( '加载拼写纠正配置失败，使用空配置:', error );
		}
	}

	/**
	 * 从配置对象加载规则到 Map 结构
	 */
	private loadConfig( config: SpellingCorrectionConfig ): void {
		// 加载全局规则
		this.globalRules = new Map(
			config.global.rules.map( rule => [ rule.from, rule.to ] )
		);

		// 加载 UID 专属规则
		this.uidRules = new Map();
		for ( const [ uidStr, uidConfig ] of Object.entries( config.uidRules ) ) {
			const uid = parseInt( uidStr, 10 );
			const rules = new Map(
				uidConfig.rules.map( rule => [ rule.from, rule.to ] )
			);
			this.uidRules.set( uid, rules );
		}
	}
	
	/**
	 * 纠正错误的游戏名
	 * @param game 原始游戏名
	 * @param uid 视频上传者 UID
	 * @returns 纠正后的游戏名
	 */
	correct( game: string, uid: number ): string {
		let result = game;

		// 第一步：应用 UID 专属规则
		const uidRuleMap = this.uidRules.get( uid );
		if ( uidRuleMap ) {
			const uidCorrection = uidRuleMap.get( result );
			if ( uidCorrection ) {
				result = uidCorrection;
			}
		}

		// 第二步：应用全局规则
		const globalCorrection = this.globalRules.get( result );
		if ( globalCorrection ) {
			result = globalCorrection;
		}

		return result;
	}
}