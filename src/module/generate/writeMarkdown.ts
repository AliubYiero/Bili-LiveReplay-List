import { join, resolve } from 'node:path';
import { cwd } from 'node:process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

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
	const liverDirPath = join( docxDirPath, info.liver );
	if ( !existsSync( liverDirPath ) ) {
		mkdirSync( liverDirPath, { recursive: true } );
	}
	const markdownFilePath = join( liverDirPath, `${ info.liver }直播回放列表(from ${ info.uploader }).md` );
	writeFileSync( markdownFilePath, info.content, 'utf-8' );
};
