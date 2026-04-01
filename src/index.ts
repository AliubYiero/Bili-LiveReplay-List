import * as console from 'node:console';
import { matchVideoList } from './module/matchData/matchVideoList.ts';
import { handleParseMapper } from './module/matchData/handleParseMapper.ts';
import { RecordStore } from './store/RecordStore.ts';
import {
	generateMarkdownRecord,
} from './module/generateReadme/generateMarkdownRecord.ts';
import { generateREADME } from './module/generateReadme/generateREADME.ts';
import { AidMapperStore } from './store/AidMapperStore.ts';
import { generateWeb } from './module/generateWeb/generateWeb.ts';


const main = async () => {
	for ( const { uid, userName, onParse } of handleParseMapper ) {
		// 读取新增投稿
		await matchVideoList( uid, userName, onParse );
		// 生成 markdown 文件
		const configStore = new RecordStore( uid, userName );
		generateMarkdownRecord( uid, userName, configStore );
		// 更新 aid 映射文件
		const aidList = configStore.recordList.map( record => String( record.aid ) );
		const aidMapperStore = new AidMapperStore( uid, userName );
		aidMapperStore.update( aidList );
	}
	// 更新 README
	generateREADME();
	// 更新 web ui
	generateWeb().catch( console.error )
};

main().catch( console.error );
