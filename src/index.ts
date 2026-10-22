// 必须放在最前面: 让后续模块在读取时不至于拿不到 .env 里的配置 (如 BILI_COOKIE)
import 'dotenv/config';
import * as console from 'node:console';
import { appendFileSync } from 'node:fs';
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
	shouldFailRun,
} from './module/runDailyUpdate.ts';
import type { DailyUpdateResult, UploaderFailure } from './module/runDailyUpdate.ts';

/**
 * 把本轮失败写进 GitHub Actions 的 step summary 与 annotation
 *
 * 只在 Actions 环境里生效, 本地运行保持纯终端输出。
 */
const reportFailuresToCi = ( failures: UploaderFailure[] ) => {
	if ( failures.length === 0 || process.env.GITHUB_ACTIONS !== 'true' ) return;

	const summaryPath = process.env.GITHUB_STEP_SUMMARY;
	if ( summaryPath ) {
		try {
			appendFileSync(
				summaryPath,
				`\n### ⚠️ 本次运行有上传者未更新\n\n\`\`\`\n${ formatFailureSummary( failures ) }\n\`\`\`\n`,
			);
		}
		catch ( error ) {
			console.error( '[写入 step summary 失败]', error );
		}
	}

	console.log(
		`::warning::本次运行有 ${ failures.length } 个环节失败（单上传者风控不计为任务失败，详见日志）`,
	);
};

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
		reportFailuresToCi( result.failures );

		// 采集层的风控失败只告警: 旧数据仍在, 产物已生成并部署, 下次运行会继续重试。
		// 文档生成失败才让这次运行失败。
		if ( shouldFailRun( result.failures ) ) {
			process.exitCode = 1;
		}
	}
};

main().catch( ( error ) => {
	console.error( error );
	process.exitCode = 1;
} );
