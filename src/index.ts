// 必须放在最前面: 让后续模块在读取时不至于拿不到 .env 里的配置 (如 BILI_COOKIE)
import 'dotenv/config';
import * as console from 'node:console';
import { chromium } from 'playwright';
import { matchVideoList } from './module/matchData/matchVideoList.ts';
import {
	assertValidParseMapper,
	handleParseMapper,
} from './module/matchData/handleParseMapper.ts';
import { RecordStore } from './store/RecordStore.ts';
import {
	generateMarkdownRecord,
} from './module/generateReadme/generateMarkdownRecord.ts';
import { generateREADME } from './module/generateReadme/generateREADME.ts';
import { AidMapperStore } from './store/AidMapperStore.ts';
import { generateWebData } from './module/generateWeb/generateWebData.ts';
import { assertBilibiliCookie } from './scraper/bilibiliCookie.ts';


const main = async () => {
	assertValidParseMapper();
	// 只要有一个 UID 用 upload, 就必须有登录态
	assertBilibiliCookie(
		handleParseMapper.some( item => item.videoSourceType !== 'replay' ),
	);

	// 浏览器全局只启动一次, 每个数据源各自开一个 context
	const browser = await chromium.launch( { headless: true } );

	try {
		for ( const {
			uid,
			userName,
			videoSourceType,
			seriesId,
			onParse,
		} of handleParseMapper ) {
			// 读取新增投稿
			await matchVideoList( uid, userName, videoSourceType, seriesId, onParse, browser );
			// 生成 markdown 文件
			const configStore = new RecordStore( uid, userName );
			generateMarkdownRecord( uid, userName, configStore );
			// 更新 aid 映射文件
			const aidList = configStore.recordList.map( record => String( record.aid ) );
			const aidMapperStore = new AidMapperStore( uid, userName );
			aidMapperStore.update( aidList );
		}
	}
	finally {
		await browser.close();
	}

	// 更新 README
	generateREADME();
	// 更新 web ui 的数据（index.html 为手维护静态页, 不在这里生成）
	generateWebData().catch( console.error )
};

main().catch( console.error );
