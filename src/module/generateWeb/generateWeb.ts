import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { RecordItem } from '../../interface/IRecord.ts';
import { DataPathManager } from '../../utils/DataPathManager.ts';
import { group } from 'radash';
import { SpellingCorrection } from '../generateReadme/SpellingCorrection.ts';
import { AidMapperStore } from '../../store/AidMapperStore.ts';
import { createWebIndexContent } from './createWebIndexContent.ts';
import path from 'path';

/**
 * 上传者数据结构
 */
export interface UploaderData {
	userName: string;
	totalVideos: number;
	latestUpdate: number;
	oldestTime: number;
	newestTime: number;
	isSelf: boolean;
	records: RecordItem[];
}

/**
 * 主播数据结构
 */
export interface StreamerRecord {
	liver: string;
	uploaders: UploaderData[];
}

/**
 * 从单个 record.json 文件生成上传者数据
 */
const generateUploaderData = async (
	uid: number,
	userName: string,
): Promise<UploaderData | null> => {
	const recordFilePath = DataPathManager.getRecordFilePath(uid, userName);

	if (!existsSync(recordFilePath)) {
		console.warn(`Record file not found: ${recordFilePath}`);
		return null;
	}

	try {
		const content = readFileSync(recordFilePath, 'utf8');
		const data = JSON.parse(content);

		if (!data.records || !Array.isArray(data.records) || data.records.length === 0) {
			console.warn(`No records found for ${userName} (${uid})`);
			return null;
		}

		const records: RecordItem[] = data.records;
		const aidMapper = new AidMapperStore(uid, userName);
		const spellingCorrection = new SpellingCorrection();

		// 按直播时间升序排序（从早到晚），用于计算全局集数
		const sortedRecords = [...records].sort((a, b) => a.liveTime - b.liveTime);

		// 游戏全局集数计数器
		const gamePartCounter: Record<string, number> = {};

		// 处理每个记录，应用游戏名纠正、aidMapper 修正和 _globalPartMap
		const processedRecords = sortedRecords.map(record => {
			const processedRecord = { ...record } as RecordItem & { _globalPartMap?: Record<string, number> };

			// 应用 aidMapper 的游戏列表修正
			const correctionPlayGame = aidMapper.getGameList(record.aid);
			if (correctionPlayGame?.length) {
				processedRecord.playGame = correctionPlayGame;
			}

			// 应用拼写纠正
			processedRecord.playGame = processedRecord.playGame.map(game =>
				spellingCorrection.correct(game, uid),
			);

			// 计算 _globalPartMap：为每个游戏维护全局集数
			const globalPartMap: Record<string, number> = {};
			for (const game of processedRecord.playGame) {
				const counterKey = `${processedRecord.liver}-${game}`
				if (!gamePartCounter[counterKey]) {
					gamePartCounter[counterKey] = 0;
				}
				gamePartCounter[counterKey]++;
				globalPartMap[game] = gamePartCounter[counterKey];
			}
			processedRecord._globalPartMap = globalPartMap;

			return processedRecord;
		});

		// 计算统计数据
		const liveTimes = processedRecords.map(r => r.liveTime).filter(t => t > 0);
		const oldestTime = liveTimes.length > 0 ? Math.min(...liveTimes) : 0;
		const newestTime = liveTimes.length > 0 ? Math.max(...liveTimes) : 0;

		// 获取数据更新时间（cache.timestamp）
		const latestUpdate = data.cache?.timestamp || Date.now();

		// 检查是否是主播本人（userName === liver）
		// 注意：这里需要获取第一条记录的 liver 来判断
		const firstRecord = processedRecords[0];
		const isSelf = userName === firstRecord?.liver;

		return {
			userName,
			totalVideos: processedRecords.length,
			latestUpdate,
			oldestTime,
			newestTime,
			isSelf,
			records: processedRecords,
		};
	} catch (error) {
		console.error(`Error processing ${recordFilePath}:`, error);
		return null;
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
 * 生成 streamerRecords 数据
 */
export const generateStreamerRecords = async (): Promise<StreamerRecord[]> => {
	const files = collectAllRecordFiles();
	console.log(`Found ${files.length} record files`);

	const allUploaders: Array<UploaderData & { liver: string }> = [];

	// 处理每个文件
	for (const { uid, userName } of files) {
		console.log(`Processing ${userName} (${uid})...`);
		const uploaderData = await generateUploaderData(uid, userName);
		if (!uploaderData) continue;

		// 按 liver 分组记录 - 一个文件可能包含多个主播的数据
		const recordsByLiver = group(uploaderData.records, r => r.liver);

		for (const [liver, records] of Object.entries(recordsByLiver)) {
			if (!records || records.length === 0) continue;

			// 计算该主播的时间范围
			const liveTimes = records.map(r => r.liveTime).filter(t => t > 0);
			const oldestTime = liveTimes.length > 0 ? Math.min(...liveTimes) : 0;
			const newestTime = liveTimes.length > 0 ? Math.max(...liveTimes) : 0;

			// 判断是否是主播本人上传
			const isSelf = userName === liver;

			allUploaders.push({
				userName,
				totalVideos: records.length,
				latestUpdate: uploaderData.latestUpdate,
				oldestTime,
				newestTime,
				isSelf,
				records,
				liver,
			});
		}
	}

	// 按 liver 分组
	const groupedByLiver = group(allUploaders, item => item.liver);

	// 构建最终的 streamerRecords 结构
	const streamerRecords: StreamerRecord[] = Object.entries(groupedByLiver)
		.map(([liver, uploaders]) => ({
			liver,
			uploaders: uploaders!.map(u => ({
				userName: u.userName,
				totalVideos: u.totalVideos,
				latestUpdate: u.latestUpdate,
				oldestTime: u.oldestTime,
				newestTime: u.newestTime,
				isSelf: u.isSelf,
				records: u.records,
			})),
		}))
	streamerRecords.sort((a, b) => a.liver.localeCompare(b.liver, 'zh-CN'));
	streamerRecords.forEach(({uploaders}) => {
		uploaders.sort((a, b) => b.newestTime - a.newestTime)
	})

	return streamerRecords;
};

/**
 * 生成 Web 页面
 */
export const generateWeb = async () => {
	console.log('='.repeat(40));
	console.log('Starting web page generation...');
	console.log('='.repeat(40));

	// 1. 生成 streamerRecords 数据
	const streamerRecords = await generateStreamerRecords();
	console.log(`\nGenerated data for ${streamerRecords.length} streamers`);

	for (const sr of streamerRecords) {
		console.log(`  - ${sr.liver}: ${sr.uploaders.length} uploaders, ${sr.uploaders.reduce((sum, u) => sum + u.totalVideos, 0)} total videos`);
	}

	// 2. 使用 createWebIndexContent 生成完整 HTML
	const htmlContent = createWebIndexContent(streamerRecords);

	// 3. 确保输出目录存在
	const webDir = path.join(process.cwd(), 'docs');

	// 4. 写入文件
	const outputPath = path.join(webDir, 'index.html');
	writeFileSync(outputPath, htmlContent, 'utf8');

	console.log(`\n✓ Successfully generated web page: ${outputPath}`);
	console.log('='.repeat(40));
};
