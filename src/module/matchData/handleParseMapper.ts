import { RecordItem, UnparseRecordItem } from '../../interface/IRecord.ts';
import { IParseConfig, PARSE_MAPPER_CONFIG } from '../../config/parseMapper.config.ts';
import { Parser, PARSERS } from './parsers.ts';

export interface IParseItem extends IParseConfig {
	onParse: ( item: UnparseRecordItem ) => Promise<RecordItem | null>;
}

/**
 * 上传者解析器注册表
 *
 * 声明式数据来自 `PARSE_MAPPER_CONFIG`, 解析函数来自 `PARSERS`, 在这里按 uid 组装。
 */
export const handleParseMapper: IParseItem[] = PARSE_MAPPER_CONFIG.map( config => ( {
	...config,
	onParse: item => PARSERS[ config.uid ]( item, config.liverEntries ?? [] ),
} ) );

/**
 * 启动时校验解析器配置
 *
 * 1. 直播回放必须有 seriesId, 否则等采集到一半才报错太晚了。
 * 2. 配置与解析函数的 uid 必须一一对应, 漏配或多余都要在启动期暴露。
 */
export const assertValidParseMapper = (
	config: IParseConfig[] = PARSE_MAPPER_CONFIG,
	parsers: Record<number, Parser> = PARSERS,
) => {
	for ( const { uid, userName, videoSourceType, seriesId } of config ) {
		if ( ( videoSourceType === 'replay' || videoSourceType === 'both' ) && !seriesId ) {
			throw new Error(
				`配置错误: 用户 ${ userName }(uid:${ uid }) 的 videoSourceType 为 "${ videoSourceType }", 必须同时配置 seriesId`,
			);
		}
	}

	const configUids = config.map( item => item.uid );
	const parserUids = Object.keys( parsers ).map( Number );

	for ( const uid of configUids ) {
		if ( !parserUids.includes( uid ) ) {
			throw new Error(
				`配置错误: uid ${ uid } 在 PARSE_MAPPER_CONFIG 中声明, 但 PARSERS 中没有对应的解析函数`,
			);
		}
	}

	for ( const uid of parserUids ) {
		if ( !configUids.includes( uid ) ) {
			throw new Error(
				`配置错误: uid ${ uid } 在 PARSERS 中有解析函数, 但 PARSE_MAPPER_CONFIG 中没有对应的配置`,
			);
		}
	}
};
