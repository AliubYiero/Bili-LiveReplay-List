import { join, resolve } from 'node:path';
import { cwd } from 'node:process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { safeFilename } from '../../utils/filename.ts';

interface MarkdownInfo {
	liver: string;
	uploader: string;
	content: string;
}

/**
 * 写入 Markdown 文件
 */
export const writeMarkdown = ( info: MarkdownInfo ) => {
	const docxDirPath = resolve( cwd(), 'docx' );
	if ( !existsSync( docxDirPath ) ) {
		mkdirSync( docxDirPath, { recursive: true } );
	}

	// 净化文件名，防止路径遍历攻击
	const safeLiver = safeFilename( info.liver );
	const safeUploader = safeFilename( info.uploader );

	const liverDirPath = join( docxDirPath, safeLiver );
	if ( !existsSync( liverDirPath ) ) {
		mkdirSync( liverDirPath, { recursive: true } );
	}
	const markdownFilePath = join( liverDirPath, `${ safeLiver }直播回放列表(from ${ safeUploader }).md` );
	writeFileSync( markdownFilePath, info.content, 'utf-8' );
};