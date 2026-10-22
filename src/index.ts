// 必须放在最前面: 让后续模块在读取时不至于拿不到 .env 里的配置 (如 BILI_COOKIE)
import 'dotenv/config';
import * as console from 'node:console';
import { chromium } from 'playwright';
import {
	assertValidParseMapper,
	handleParseMapper,
} from './module/matchData/handleParseMapper.ts';
import { generateREADME } from './module/generateReadme/generateREADME.ts';
import { generateWebData } from './module/generateWeb/generateWebData.ts';
import { assertBilibiliCookie } from './scraper/bilibiliCookie.ts';
import {
	formatFailureSummary,
	runDailyUpdate,
} from './module/runDailyUpdate.ts';
import type { DailyUpdateResult } from './module/runDailyUpdate.ts';


const main = async () => {
	assertValidParseMapper();
	// 只要有一个 UID 用 upload, 就必须有登录态
	assertBilibiliCookie(
		handleParseMapper.some( item => item.videoSourceType !== 'replay' ),
	);

	let result: DailyUpdateResult | undefined;

	try {
		// 浏览器全局只启动一次, 每个数据源各自开一个 context
		const browser = await chromium.launch( { headless: true } );

		try {
			// 单个上传者失败不影响其余上传者
			result = await runDailyUpdate( handleParseMapper, browser );
		}
		finally {
			await browser.close();
		}
	}
	finally {
		// 无论采集结果如何都要重新生成文档与 web 产物:
		// 数据来自磁盘上的 record.json, 保证 Pages artifact 里一定有 manifest.json
		try {
			generateREADME();
		}
		catch ( error ) {
			console.error( '[生成 README 失败]', error );
			process.exitCode = 1;
		}

		try {
			await generateWebData();
		}
		catch ( error ) {
			console.error( '[生成 Web 数据失败]', error );
			process.exitCode = 1;
		}
	}

	if ( result?.failures.length ) {
		console.error( formatFailureSummary( result.failures ) );
		// 数据已生成, 但让 CI 的这次运行标红, 避免风控问题被静默吞掉
		process.exitCode = 1;
	}
};

main().catch( ( error ) => {
	console.error( error );
	process.exitCode = 1;
} );
