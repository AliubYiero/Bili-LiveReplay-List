import axios from 'axios';
import { IUserUploadVideo } from '../interface/IUserUploadVideo.ts';

/**
 * 获取用户上传的投稿数据
 */
export async function api_getUserUploadVideoList(
	uid: number,
	page = 1,
	pageSize = 30,
) {
	pageSize = Math.min( pageSize, 100 );
	const urlSearchParams = new URLSearchParams( {
		mid: uid.toString(),
		keywords: '',
		pn: page.toString(),
		ps: pageSize.toString(),
	} );
	const res = await axios.get(
		`https://api.bilibili.com/x/series/recArchivesByKeywords?${ urlSearchParams.toString() }`,
	);
	if ( res.data.code !== 0 ) {
		throw new Error( res.data.message );
	}
	const response = res.data.data as IUserUploadVideo;
	const hasNext = response.page.num * response.page.size < response.page.total;
	return Object.assign( response, {
		hasNext
	} );
}
