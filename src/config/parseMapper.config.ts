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
			{ prefix: '【Quin？机皇！】', liver: '机皇' },
			{ prefix: '【Mr.Quin】', liver: 'Mr.Quin' },
		],
	},
	{
		uid: 1400350754,
		userName: '自行车二层',
		videoSourceType: 'upload',
		// 自行车二层会搬运多个主播的录播, 前缀表比"本人"上传者更全
		liverEntries: [
			{ prefix: '【机皇录播】', liver: '机皇' },
			{ prefix: '【肯尼录播】', liver: '机智的肯尼' },
			{ prefix: '【剩饭录播】', liver: '北极熊剩饭' },
			{ prefix: '【quin录播】', liver: 'Mr.Quin' },
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
	{
		uid: 1957464,
		userName: 'Cyan_Rose_Sea',
		videoSourceType: 'upload',
		liverEntries: [
			{ prefix: '【少年Pi】', liver: '少年Pi' },
			{ prefix: '【傲慢的小肉包】', liver: '傲慢的小肉包' },
			{ prefix: '【C酱です】', liver: '傲慢的小肉包' },
		],
	},
];

/** 按 uid 索引的便捷视图, 便于按上传者查配置 */
export const PARSE_MAPPER_BY_UID: Record<number, IParseConfig> = Object.fromEntries(
	PARSE_MAPPER_CONFIG.map( config => [ config.uid, config ] ),
);

/**
 * 主播 → 头像图片直链
 *
 * 键是 `record.liver` 的原文（与解析结果严格一致），值是可直接访问的图片 URL。
 * 头像属于「主播这个人」，与上传者 / 标题前缀无关，所以独立成一张扁平表。
 * 未配置的主播由前端回退到首字母占位。
 */
export const LIVER_AVATAR_MAP: Record<string, string> = {
	'Mr.Quin': 'https://i1.hdslb.com/bfs/face/04831670be98280c50119dfa2dd13367899a7b41.jpg',
	'机皇': 'https://i1.hdslb.com/bfs/face/6c1489ba7ce6cc1f864271f68cb451bb0411cf41.jpg',
	'机智的肯尼': 'https://i1.hdslb.com/bfs/face/179b2747277b2e7d4264c931d643d8a6afd5d147.jpg',
	'北极熊剩饭': 'https://i1.hdslb.com/bfs/face/ea72dd637350e917be1cc4a222e504255adb6cde.jpg',
	'勾檀Mayumi': 'https://i1.hdslb.com/bfs/face/1fb69d482db5d033fe1e43ed112a51821f2c6ec2.jpg',
	'少年Pi': 'https://i1.hdslb.com/bfs/face/cd27b3173735e514795e455f0651108ae8891bd8.jpg',
	'傲慢的小肉包': 'https://i1.hdslb.com/bfs/garb/4d938df699cb9e367c8725f09afa249e96a5c505.png',
};

/** 查主播头像直链, 未配置返回 undefined */
export const getLiverAvatar = (liver: string): string | undefined => LIVER_AVATAR_MAP[ liver ];
