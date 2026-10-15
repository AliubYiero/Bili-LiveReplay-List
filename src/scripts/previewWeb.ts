// 让 .env 里的 PORT 生效
import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Server } from 'node:http';

/** 只监听本机回环地址，不对外暴露 */
const HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;

/**
 * 启动回放索引页的本地预览
 *
 * 数据（docs/manifest.json + docs/data/**）与静态页分开，页面通过 fetch 加载，
 * 直接双击 index.html 会因 file:// 下 fetch 被 CORS 拦下而加载不到数据，必须通过 http 访问。
 */
export function startWebPreview(): Server {
	const port = Number( process.env.PORT ) || DEFAULT_PORT;
	const docsDir = join( process.cwd(), 'docs' );

	if ( !existsSync( join( docsDir, 'manifest.json' ) ) ) {
		console.warn( '未找到 docs/manifest.json，请先运行 `npm run start` 生成数据。' );
	}

	const app = express();
	app.use( express.static( docsDir ) );

	const server = app.listen( port, HOST, () => {
		console.log( `回放索引预览已启动: http://${HOST}:${port}` );
		console.log( '按 Ctrl+C 退出。' );
	} );

	server.on( 'error', ( error: NodeJS.ErrnoException ) => {
		if ( error.code === 'EADDRINUSE' ) {
			console.error( `端口 ${port} 已被占用，请设置环境变量 PORT 指定其他端口后重试。` );
			console.error( `例如: PORT=4000 npm run preview` );
		} else {
			console.error( '回放索引预览启动失败:', error );
		}

		process.exit( 1 );
	} );

	const shutdown = ( signal: NodeJS.Signals ): void => {
		console.log( `\n收到 ${signal}，正在关闭回放索引预览…` );
		server.close( () => {
			console.log( '回放索引预览已关闭。' );
			process.exit( 0 );
		} );
	};

	process.on( 'SIGINT', shutdown );
	process.on( 'SIGTERM', shutdown );

	return server;
}

// 直接运行时启动服务；测试环境下不自动启动
if ( process.env.NODE_ENV !== 'test' ) {
	startWebPreview();
}
