import axios from 'axios';
import { IUserUploadVideo } from '../interface/IUserUploadVideo.ts';

/**
 * 带指数退避重试的异步函数包装器
 * @param fn 要执行的异步函数
 * @param maxRetries 最大重试次数（默认 3）
 * @returns Promise<T>
 */
async function withRetry<T>(
	fn: () => Promise<T>,
	maxRetries: number = 3
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt < maxRetries) {
				// 指数退避：20s, 40s, 80s
				const delay = Math.pow(2, attempt) * 20000;
				console.info(`API 请求失败，第 ${attempt + 1} 次重试...`);
				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
	}

	throw new Error(`API 请求在 ${maxRetries} 次重试后仍失败: ${lastError?.message}`);
}

/**
 * 获取用户上传的投稿数据
 */
export async function api_getUserUploadVideoList(
	uid: number,
	page = 1,
	pageSize = 30,
) {
	pageSize = Math.min(pageSize, 100);
	const urlSearchParams = new URLSearchParams({
		mid: uid.toString(),
		keywords: '',
		pn: page.toString(),
		ps: pageSize.toString(),
	});

	// 使用 withRetry 包装网络请求，但业务错误直接抛出
	const res = await withRetry(async () => {
		return await axios.get(
			`https://api.bilibili.com/x/series/recArchivesByKeywords?${urlSearchParams.toString()}`,
		);
	});

	// 业务错误直接抛出，不重试
	if (res.data.code !== 0) {
		throw new Error(res.data.message);
	}

	const response = res.data.data as IUserUploadVideo;
	const hasNext = response.page.num * response.page.size < response.page.total;
	return Object.assign(response, { hasNext });
}
