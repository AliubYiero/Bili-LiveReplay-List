import { RecordItem } from '../../interface/IRecord.ts';
import { RecordStore } from '../../store/RecordStore.ts';
import { getIncrementalVideoList } from './getIncrementalVideoList.ts';
import { IParseItem } from './handleParseMapper.ts';
import { isToday } from '../../utils/dateUtils.ts';

export const matchVideoList = async (
	uid: number,
	userName: string,
	onParse: IParseItem['onParse'],
) => {
	console.info(`正在读取用户 ${userName}(uid:${uid}) 的投稿视频列表:`);
	const configStore = new RecordStore(uid, userName);

	// 新增：检查今天是否已更新
	if (isToday(configStore.cache.timestamp)) {
		console.info(`用户 ${userName} 今天已更新，跳过数据获取`);
		return false;
	}

	const unparseVideoList = await getIncrementalVideoList(uid, configStore);
	const videoList = (await Promise.all(unparseVideoList.map(onParse)))
		.filter(Boolean) as RecordItem[];
	await configStore.addRecord(...videoList);
	console.info(`用户 ${userName}(uid:${uid}) 更新了 ${videoList.length} 个视频`);
	console.info('-'.repeat(20));
	return Boolean(videoList.length);
};