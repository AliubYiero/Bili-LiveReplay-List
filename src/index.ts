import * as console from 'node:console';
import { matchVideoList } from './module/matchData/matchVideoList.ts';
import { handleParseMapper } from './module/matchData/handleParseMapper.ts';
import { RecordStore } from './store/RecordStore.ts';
import { generateMarkdownRecord } from './module/generate/generateMarkdownRecord.ts';
import { generateREADME } from './module/generate/generateREADME.ts';


const main = async () => {
	for ( const { uid, userName, onParse } of handleParseMapper ) {
		// 读取新增投稿
		await matchVideoList( uid, userName, onParse );
		// 生成 markdown 文件
		const configStore = new RecordStore( uid, userName );
		generateMarkdownRecord( userName, configStore );
	}
	// 更新 README
	generateREADME()
	
};

main().catch( console.error );
