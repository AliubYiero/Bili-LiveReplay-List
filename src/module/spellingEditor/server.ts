import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SpellingRule } from '../../interface/ISpellingCorrection.ts';
import {
	getConfig,
	saveFullConfig,
	saveGlobalRules,
	saveUidRules,
	SpellingEditorError
} from './storage.ts';
import type { SpellingEditorErrorType } from './validator.ts';
import { listUsers, readUserRecords, saveAidRules } from './recordsStorage.ts';
import type { AidRules } from './recordsValidator.ts';

/** 错误类型到 HTTP 状态码的映射 */
const HTTP_STATUS: Record<SpellingEditorErrorType, number> = {
	VALIDATION_ERROR: 400,
	DUPLICATE_FROM: 400,
	UID_NOT_FOUND: 400,
	USER_NOT_FOUND: 400,
	AID_FILE_NOT_FOUND: 400,
	LOCKED: 423,
	INTERNAL_ERROR: 500
};

const PUBLIC_DIR = join( dirname( fileURLToPath( import.meta.url ) ), 'public' );

/** 录播数据路由共用的路径参数 */
interface UserParams {
	uid: string;
	userName: string;
}

/**
 * 创建本地数据编辑器的 Express 应用
 * 托管「拼写规则」/ 与「录播数据」/records 两个页面
 * 只负责 HTTP 层：解析请求、调用 storage、统一错误格式，不直接操作文件系统
 */
export function createApp(): Express {
	const app = express();

	app.use( express.json( { limit: '1mb' } ) );
	app.use( express.static( PUBLIC_DIR ) );

	app.get( '/api/spelling', ( _req: Request, res: Response ) => {
		try {
			res.json( getConfig() );
		} catch ( error ) {
			sendError( res, error );
		}
	} );

	app.post( '/api/spelling/global', async ( req: Request, res: Response ) => {
		try {
			await saveGlobalRules( readRules( req.body ) );
			res.json( { success: true } );
		} catch ( error ) {
			sendError( res, error );
		}
	} );

	app.post( '/api/spelling/uid/:uid', async ( req: Request<{ uid: string }>, res: Response ) => {
		try {
			await saveUidRules( req.params.uid, readRules( req.body ) );
			res.json( { success: true } );
		} catch ( error ) {
			sendError( res, error );
		}
	} );

	app.post( '/api/spelling', async ( req: Request, res: Response ) => {
		try {
			await saveFullConfig( req.body );
			res.json( { success: true } );
		} catch ( error ) {
			sendError( res, error );
		}
	} );

	app.get( '/records', ( _req: Request, res: Response ) => {
		// 必须用 root 形式而不是绝对路径：send 会按路径分隔符拆包做 dotfile 检查，
		// 仓库路径里只要有以点开头的目录（如 D:\Code\.project\...）就会被判成 dotfile 而 404。
		// 传 root 时只检查相对文件名，与 express.static 的行为一致。
		res.sendFile( 'records.html', { root: PUBLIC_DIR } );
	} );

	app.get( '/api/records/users', ( _req: Request, res: Response ) => {
		try {
			res.json( { users: listUsers() } );
		} catch ( error ) {
			sendError( res, error );
		}
	} );

	app.get( '/api/records/:uid/:userName', ( req: Request<UserParams>, res: Response ) => {
		try {
			const { uid, userName } = readUserParams( req.params );
			res.json( readUserRecords( uid, userName ) );
		} catch ( error ) {
			sendError( res, error );
		}
	} );

	app.post( '/api/records/:uid/:userName/aid', async ( req: Request<UserParams>, res: Response ) => {
		try {
			const { uid, userName } = readUserParams( req.params );
			await saveAidRules( uid, userName, readAidRules( req.body ) );
			res.json( { success: true } );
		} catch ( error ) {
			sendError( res, error );
		}
	} );

	// 兜底错误处理：主要覆盖 express.json() 的解析失败
	app.use( ( error: Error, _req: Request, res: Response, next: NextFunction ) => {
		if ( res.headersSent ) {
			next( error );
			return;
		}

		if ( error instanceof SyntaxError ) {
			res.status( 400 ).json( {
				success: false,
				error: 'VALIDATION_ERROR',
				message: '请求体不是合法 JSON'
			} );
			return;
		}

		// 路径参数里的百分号编码非法时 router 会抛 URIError，这是请求的问题而不是服务端故障
		if ( error instanceof URIError ) {
			res.status( 400 ).json( {
				success: false,
				error: 'VALIDATION_ERROR',
				message: 'URL 路径参数不是合法的百分号编码'
			} );
			return;
		}

		sendError( res, error );
	} );

	return app;
}

/** 从请求体中取出 rules 数组，缺失或类型不对时抛 VALIDATION_ERROR */
function readRules( body: unknown ): SpellingRule[] {
	const rules = ( body as { rules?: unknown } | null | undefined )?.rules;

	if ( !Array.isArray( rules ) ) {
		throw new SpellingEditorError( 'VALIDATION_ERROR', '请求体缺少 rules 数组' );
	}

	return rules as SpellingRule[];
}

/**
 * 从请求体中取出 aid 映射对象
 * 只做「是不是对象」这一层判断，逐条标签的校验交给 validateAidRules
 */
function readAidRules( body: unknown ): AidRules {
	const rules = ( body as { rules?: unknown } | null | undefined )?.rules;

	if ( typeof rules !== 'object' || rules === null || Array.isArray( rules ) ) {
		throw new SpellingEditorError( 'VALIDATION_ERROR', '请求体缺少 rules 对象' );
	}

	return rules as AidRules;
}

/** 取出并校验路径参数：UID 必须是纯数字，用户名交给 DataPathManager 做文件名净化 */
function readUserParams( params: UserParams ): { uid: string; userName: string } {
	const { uid, userName } = params;

	if ( !/^\d+$/.test( uid ) ) {
		throw new SpellingEditorError( 'USER_NOT_FOUND', `UID 非法: ${uid}` );
	}

	if ( userName.trim() === '' ) {
		throw new SpellingEditorError( 'USER_NOT_FOUND', '用户名不能为空' );
	}

	return { uid, userName };
}

/** 统一错误响应格式：{ success: false, error, message } */
function sendError( res: Response, error: unknown ): void {
	if ( error instanceof SpellingEditorError ) {
		res.status( HTTP_STATUS[ error.type ] ?? 500 ).json( {
			success: false,
			error: error.type,
			message: error.message
		} );
		return;
	}

	console.error( '本地数据编辑器内部错误:', error );
	res.status( 500 ).json( {
		success: false,
		error: 'INTERNAL_ERROR',
		message: '服务器内部错误，请检查控制台日志'
	} );
}
