import { VideoSourceOption } from '../interface/IRecord.ts';

/** 标题前缀 → 主播 的匹配条目 */
export interface ILiverEntry {
	/** 标题中的前缀原文, 匹配时由代码统一归一化 */
	prefix: string;
	/** 命中后返回的主播名 */
	liver: string;
}

/** 单个上传者的声明式配置, 不含任何解析实现 */
export interface IParseConfig {
	uid: number;
	userName: string;
	/** 该 UID 的数据源类型: 主页视频 / 直播回放 / 两者都采集 */
	videoSourceType: VideoSourceOption;
	/** 直播回放合集 ID, `replay` / `both` 时必需 */
	seriesId?: number;
	/** 该上传者标题里使用的前缀表; 不解析主播的上传者可以不配 */
	liverEntries?: ILiverEntry[];
}

/**
 * 上传者解析配置
 *
 * 这里只放声明式数据, 解析实现 (`onParse`) 在 `module/matchData/parsers.ts` 里按 uid 一一对应。
 * 顺序决定 `handleParseMapper` 的遍历顺序。
 */
export const PARSE_MAPPER_CONFIG: IParseConfig[] = [
	{
		uid: 245335,
		userName: '胧黑',
		videoSourceType: 'upload',
		liverEntries: [
			{ prefix: '【机皇录播】', liver: '机皇' },
			{ prefix: '【Quin？机皇！】', liver: '机皇' },
		],
	},
	{
		uid: 1400350754,
		userName: '自行车二层',
		videoSourceType: 'upload',
		// 自行车二层会搬运多个主播的录播, 前缀表比"本人"上传者更全
		liverEntries: [
			{ prefix: '【机皇录播】', liver: '机皇' },
			{ prefix: '【Quin？机皇！】', liver: '机皇' },
			{ prefix: '【肯尼录播】', liver: '机智的肯尼' },
			{ prefix: '【剩饭录播】', liver: '北极熊剩饭' },
			{ prefix: '【quin录播】', liver: 'Mr.Quin' },
			{ prefix: '【Mr.Quin】', liver: 'Mr.Quin' },
		],
	},
	{
		uid: 15810,
		userName: 'Mr.Quin',
		videoSourceType: 'upload',
	},
	{
		uid: 690608693,
		userName: '勾檀Mayumi',
		videoSourceType: 'replay',
		seriesId: 91376,
	},
];

/** 按 uid 索引的便捷视图, 便于按上传者查配置 */
export const PARSE_MAPPER_BY_UID: Record<number, IParseConfig> = Object.fromEntries(
	PARSE_MAPPER_CONFIG.map( config => [ config.uid, config ] ),
);
