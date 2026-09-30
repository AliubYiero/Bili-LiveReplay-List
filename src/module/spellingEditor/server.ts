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

/** 错误类型到 HTTP 状态码的映射 */
const HTTP_STATUS: Record<SpellingEditorErrorType, number> = {
	VALIDATION_ERROR: 400,
	DUPLICATE_FROM: 400,
	UID_NOT_FOUND: 400,
	LOCKED: 423,
	INTERNAL_ERROR: 500
};

const PUBLIC_DIR = join( dirname( fileURLToPath( import.meta.url ) ), 'public' );

/**
 * 创建拼写纠正编辑器的 Express 应用
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

	console.error( '拼写纠正编辑器内部错误:', error );
	res.status( 500 ).json( {
		success: false,
		error: 'INTERNAL_ERROR',
		message: '服务器内部错误，请检查控制台日志'
	} );
}
