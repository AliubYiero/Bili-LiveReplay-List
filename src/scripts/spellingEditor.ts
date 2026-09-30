import type { Server } from 'node:http';
import { createApp } from '../module/spellingEditor/server.ts';

/** 只监听本机回环地址，不对外暴露 */
const HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;

/**
 * 启动本地数据编辑器
 * 服务与主流程完全解耦，只通过读写 data/ 下的配置文件交互
 * 托管两个页面：「拼写规则」/ 与「录播数据」/records
 */
export function startSpellingEditor(): Server {
	const port = Number( process.env.PORT ) || DEFAULT_PORT;
	const server = createApp().listen( port, HOST, () => {
		console.log( `本地数据编辑器已启动: http://${HOST}:${port}` );
		console.log( `  拼写规则: http://${HOST}:${port}/` );
		console.log( `  录播数据: http://${HOST}:${port}/records` );
		console.log( '按 Ctrl+C 退出。' );
	} );

	server.on( 'error', ( error: NodeJS.ErrnoException ) => {
		if ( error.code === 'EADDRINUSE' ) {
			console.error( `端口 ${port} 已被占用，请设置环境变量 PORT 指定其他端口后重试。` );
			console.error( `例如: PORT=3001 npm run edit` );
		} else {
			console.error( '本地数据编辑器启动失败:', error );
		}

		process.exit( 1 );
	} );

	const shutdown = ( signal: NodeJS.Signals ): void => {
		console.log( `\n收到 ${signal}，正在关闭本地数据编辑器…` );
		server.close( () => {
			console.log( '本地数据编辑器已关闭。' );
			process.exit( 0 );
		} );
	};

	process.on( 'SIGINT', shutdown );
	process.on( 'SIGTERM', shutdown );

	return server;
}

// 直接运行时启动服务；测试环境下不自动启动
if ( process.env.NODE_ENV !== 'test' ) {
	startSpellingEditor();
}
