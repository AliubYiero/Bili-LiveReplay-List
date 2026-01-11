import {
	api_getUserUploadVideoList,
} from '../../api/api_getUserUploadVideoList.ts';
import { UnparseRecordItem } from '../../interface/IRecord.ts';
import { archiveItem } from '../../interface/IUserUploadVideo.ts';
import { sleep } from 'radash';
import { RecordStore } from '../../store/RecordStore.ts';

/**
 * 解析获取到的视频数据, 返回项目的记录结构
 */
const parseArchive = ( item: archiveItem ): UnparseRecordItem => {
	return {
		aid: item.aid,
		bvId: item.bvid,
		liveDuration: item.duration,
		publishTime: item.pubdate * 1000,
		title: item.title,
	};
};

/**
 * 获取增量的视频列表
 */
export const getIncrementalVideoList = async (
	uid: number,
	configStore: RecordStore,
) => {
	const videoList: UnparseRecordItem[] = [];
	
	let page: number = 1;
	let hasNextPage = true;
	while ( hasNextPage ) {
		// 获取投稿信息
		const response = await api_getUserUploadVideoList(
			uid,
			page,
			100,
		).then( async res => {
			await sleep( 300 );
			return res;
		} );
		// 更新判断信息
		hasNextPage = response.hasNext;
		const { total, size } = response.page;
		const maxPage = Math.ceil( total / size );
		console.info( `正在读取用户 ${ uid } 的投稿视频...(Page ${ page } / ${ maxPage })` );
		page++;
		
		// 检查当前记录的视频标题是否改变
		let checkCache = false;
		// 解析获取到的视频信息列表
		for ( let archive of response.archives ) {
			// 如果到达了缓存点, 退出解析
			if ( configStore.arrivedCachePoint( archive.aid ) ) {
				hasNextPage = false;
				checkCache = true;
			}
			
			const record = parseArchive( archive );
			// 判断是否进入了缓存检查阶段, 如果不是, 则正常添加视频记录
			if ( !checkCache ) {
				videoList.push( record );
				continue;
			}
			
			// 进入缓存检查阶段, 检查标题是否一致
			const isSameTitle = configStore.checkCacheVideoTitle( record );
			// 若不一致, 删除缓存视频, 重新添加进解析
			if ( !isSameTitle ) {
				record.updateTime = false;
				videoList.push( record );
			}
		}
	}
	return videoList;
};
