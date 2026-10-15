import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync } from 'fs';
import { IRecord } from '../../interface/IRecord.ts';
import { DataPathManager } from '../../utils/DataPathManager.ts';
import { safeFilename } from '../../utils/filename.ts';
import { group } from 'radash';
import { SpellingCorrection } from '../generateReadme/SpellingCorrection.ts';
import { AidMapperStore } from '../../store/AidMapperStore.ts';
import { createWebIndexContent } from './createWebIndexContent.ts';
import path from 'path';

/**
 * 写进 `data/<主播>/<上传者>.json` 的单条记录
 *
 * 只保留前端真正用得到的字段: `bvId` / `publishTime` / `liver` 在页面上从未被读取,
 * `_globalPartMap` 改由前端加载后自行计算。`record.json` 才是权威数据源, 字段不动。
 */
export interface WebRecord {
	aid: number;
	title: string;
	liveTime: number;
	liveDuration: number;
	playGame: string[];
}

/**
 * 单个 (主播, 上传者) 的数据文件
 */
export interface UploaderDataFile {
	liver: string;
	userName: string;
	latestUpdate: number;
	records: WebRecord[];
}

/**
 * manifest 中的上传者摘要（不含 records）
 */
export interface UploaderManifest {
	userName: string;
	totalVideos: number;
	latestUpdate: number;
	oldestTime: number;
	newestTime: number;
	isSelf: boolean;
	/** 相对 index.html 的数据文件 URL（已 encodeURIComponent） */
	dataFile: string;
}

/**
 * manifest 中的主播条目
 */
export interface StreamerManifest {
	liver: string;
	uploaders: UploaderManifest[];
}

/**
 * 内联进 `index.html` 的清单: 首屏只需要它就能渲染主播列表和上传者卡片
 */
export interface WebManifest {
	streamers: StreamerManifest[];
}

/**
 * 一次生成所需的全部内容（不落盘, 便于测试）
 */
export interface WebOutput {
	manifest: WebManifest;
	dataFiles: Array<{ relativePath: string; content: UploaderDataFile }>;
}

/**
 * 计算直播时间范围（忽略无效的 0 值）
 */
export const summarizeLiveTimes = (records: Array<{ liveTime: number }>) => {
	const liveTimes = records.map(r => r.liveTime).filter(t => t > 0);
	return {
		oldestTime: liveTimes.length > 0 ? Math.min(...liveTimes) : 0,
		newestTime: liveTimes.length > 0 ? Math.max(...liveTimes) : 0,
	};
};

/**
 * 由 (主播, 上传者) 推导数据文件在 `docs/` 下的相对路径与对外 URL
 *
 * 落盘用的是 safeFilename, URL 用的是它的 encodeURIComponent —— 两者一一对应,
 * 所以前端拿到 manifest 里的 `dataFile` 就能直接 fetch, 不需要自己拼路径。
 */
export const buildDataFileLocation = (liver: string, userName: string) => {
	const dir = safeFilename(liver);
	const file = `${safeFilename(userName)}.json`;
	return {
		relativePath: path.join('data', dir, file),
		url: `data/${encodeURIComponent(dir)}/${encodeURIComponent(file)}`,
	};
};

/**
 * 读取单个 record.json, 按主播拆分成「每主播一份」的数据文件
 */
const buildUploaderDataFiles = (uid: number, userName: string): UploaderDataFile[] => {
	const recordFilePath = DataPathManager.getRecordFilePath(uid, userName);

	if (!existsSync(recordFilePath)) {
		console.warn(`Record file not found: ${recordFilePath}`);
		return [];
	}

	try {
		const content = readFileSync(recordFilePath, 'utf8');
		const data: IRecord = JSON.parse(content);

		if (!Array.isArray(data.records) || data.records.length === 0) {
			console.warn(`No records found for ${userName} (${uid})`);
			return [];
		}

		const aidMapper = new AidMapperStore(uid, userName);
		const spellingCorrection = new SpellingCorrection();
		// 数据更新时间（cache.timestamp）
		const latestUpdate = data.cache?.timestamp || Date.now();

		// 一个文件可能包含多个主播的数据
		const recordsByLiver = group(data.records, r => r.liver);

		return Object.entries(recordsByLiver)
			.filter(([, records]) => !!records?.length)
			.map(([liver, records]) => {
				// 按直播时间升序排列: 与前端计算 Part 序号时的顺序保持一致
				const processedRecords: WebRecord[] = [...records!]
					.sort((a, b) => a.liveTime - b.liveTime)
					.map(record => {
						// aidMapper 的人工映射优先, 为空数组时回退到标题解析结果
						const correctionPlayGame = aidMapper.getGameList(record.aid);
						const playGame = correctionPlayGame?.length
							? correctionPlayGame
							: record.playGame;

						return {
							aid: record.aid,
							title: record.title,
							liveTime: record.liveTime,
							liveDuration: record.liveDuration,
							// 应用拼写纠正
							playGame: playGame.map(game => spellingCorrection.correct(game, uid)),
						};
					});

				return { liver, userName, latestUpdate, records: processedRecords };
			});
	} catch (error) {
		console.error(`Error processing ${recordFilePath}:`, error);
		return [];
	}
};

/**
 * 收集所有数据文件信息（使用 Node.js 内置 fs 模块）
 */
const collectAllRecordFiles = (): Array<{ uid: number; userName: string }> => {
	const dataDir = DataPathManager.getDataDir();
	const result: Array<{ uid: number; userName: string }> = [];

	try {
		// 读取 data 目录下的所有子目录（UID 目录）
		const uidDirs = readdirSync(dataDir).filter(name => {
			const fullPath = path.join(dataDir, name);
			return statSync(fullPath).isDirectory() && /^\d+$/.test(name);
		});

		for (const uidDir of uidDirs) {
			const uid = parseInt(uidDir, 10);
			const uidPath = path.join(dataDir, uidDir);

			// 读取该 UID 目录下的所有文件
			const files = readdirSync(uidPath);

			for (const file of files) {
				// 查找 .record.json 文件
				if (file.endsWith('.record.json')) {
					const userName = file.replace('.record.json', '');
					if (!isNaN(uid) && userName) {
						result.push({ uid, userName });
					}
				}
			}
		}
	} catch (error) {
		console.error('Error collecting record files:', error);
	}

	return result;
};

/**
 * 生成 manifest 与全部数据文件内容
 */
export const buildWebOutput = (): WebOutput => {
	const recordFiles = collectAllRecordFiles();
	console.log(`Found ${recordFiles.length} record files`);

	const dataFiles: WebOutput['dataFiles'] = [];

	for (const { uid, userName } of recordFiles) {
		for (const uploaderDataFile of buildUploaderDataFiles(uid, userName)) {
			const location = buildDataFileLocation(
				uploaderDataFile.liver,
				uploaderDataFile.userName,
			);
			dataFiles.push({ relativePath: location.relativePath, content: uploaderDataFile });
		}
	}

	// 按主播分组, 每个上传者只保留摘要
	const groupedByLiver = group(dataFiles, item => item.content.liver);

	const streamers: StreamerManifest[] = Object.entries(groupedByLiver).map(
		([liver, items]) => ({
			liver,
			uploaders: items!.map(({ content }) => {
				const { oldestTime, newestTime } = summarizeLiveTimes(content.records);
				return {
					userName: content.userName,
					totalVideos: content.records.length,
					latestUpdate: content.latestUpdate,
					oldestTime,
					newestTime,
					isSelf: content.userName === liver,
					dataFile: buildDataFileLocation(content.liver, content.userName).url,
				};
			}),
		}),
	);

	streamers.sort((a, b) => a.liver.localeCompare(b.liver, 'zh-CN'));
	streamers.forEach(({ uploaders }) => {
		uploaders.sort((a, b) => b.newestTime - a.newestTime);
	});

	return { manifest: { streamers }, dataFiles };
};

/**
 * 生成 Web 页面
 *
 * - `docs/index.html`: 外壳 + 内联 manifest（不随数据量增长）
 * - `docs/data/<主播>/<上传者>.json`: 每个 (主播, 上传者) 一份, 进详情页时才加载
 */
export const generateWeb = async () => {
	console.log('='.repeat(40));
	console.log('Starting web page generation...');
	console.log('='.repeat(40));

	const { manifest, dataFiles } = buildWebOutput();
	console.log(`\nGenerated data for ${manifest.streamers.length} streamers`);
	for (const streamer of manifest.streamers) {
		const totalVideos = streamer.uploaders.reduce((sum, u) => sum + u.totalVideos, 0);
		console.log(`  - ${streamer.liver}: ${streamer.uploaders.length} uploaders, ${totalVideos} total videos`);
	}

	const webDir = path.join(process.cwd(), 'docs');
	const dataDir = path.join(webDir, 'data');

	// 先清空: 被移除的上传者不该留下孤儿文件
	rmSync(dataDir, { recursive: true, force: true });

	const indexPath = path.join(webDir, 'index.html');
	writeFileSync(indexPath, createWebIndexContent(manifest), 'utf8');
	console.log(`\n✓ Successfully generated web page: ${indexPath}`);

	for (const { relativePath, content } of dataFiles) {
		const targetPath = path.join(webDir, relativePath);
		mkdirSync(path.dirname(targetPath), { recursive: true });
		writeFileSync(targetPath, JSON.stringify(content), 'utf8');
	}
	console.log(`✓ Successfully generated ${dataFiles.length} data files in ${dataDir}`);
	console.log('='.repeat(40));
};
