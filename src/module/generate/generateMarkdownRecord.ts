import { RecordStore } from '../../store/RecordStore.ts';
import { PlayGameRecordItem, RecordItem } from '../../interface/IRecord.ts';
import { writeMarkdown } from './writeMarkdown.ts';
import { group } from 'radash';
import { formatTime } from './formatTime.ts';
import { SpellingCorrection } from './SpellingCorrection.ts';
import { formatDate } from './formatDate.ts';

/**
 * 生成 Markdown 文件
 */
export const generateMarkdownRecord = (
	userName: string,
	configStore: RecordStore,
) => {
	const spellingCorrection = new SpellingCorrection();
	const liverMapper = group( configStore.recordList, item => item.liver );
	// 更新分组下的每个文档
	for ( let liver in liverMapper ) {
		const recordList = liverMapper[ liver as RecordItem['liver'] ];
		if ( !recordList ) continue;
		
		// 降序排序记录
		recordList.sort( ( a, b ) => b.publishTime - a.publishTime );
		const oldestVideo = recordList[ recordList.length - 1 ];
		const latestVideo = recordList[ 0 ];
		
		// 生成单个游戏标记的记录
		const playGameRecord: PlayGameRecordItem[] = recordList.flatMap( record => {
			return record.playGame.map( game => ( {
				...record,
				playGame: spellingCorrection.correct( game ),
			} ) );
		} );
		const gameList = group( playGameRecord, item => item.playGame );
		const content = `
# ${ liver } 直播回放 (from ${ userName })

| 主播 | ${ liver } |
| -------------------- | ------------------------------------------------------------ |
| **上传者** | **${ userName }** |
| **数据更新时间** | **${ formatDate( configStore.cache.timestamp ) }** |
| **累积计入视频数量** | **${ recordList.length }** |
| **最旧视频** | [${ oldestVideo.title }](https://www.bilibili.com/video/av${ oldestVideo.aid }/) |
| **最新视频** | [${ latestVideo.title }](https://www.bilibili.com/video/av${ latestVideo.aid }/) |

---

${ Object.entries( gameList ).map( ( [ game, infoList ] ) => `
## ${ game }

| 游戏名称 | 直播日期 | 时长 | 集数   | 标题                                                         |
| -------- | -------- | ---- | ------ | ------------------------------------------------------------ |
${ infoList!.reverse().map( ( info, index ) => `
| ${ game } | ${ formatDate( info.liveTime ) } | ${ formatTime( info.liveDuration ) } | Part ${ index + 1 } | [${ info.title }](https://www.bilibili.com/video/av${ info.aid }/) |
`.trim() ).join( '\n' ) }
`.trim() ).join( '\n\n' ) }

	`.trim();
		
		writeMarkdown( {
			content: content,
			liver: liver,
			uploader: userName,
		} );
		console.info( `正在生成 ${ liver } 的直播回放列表 (from ${ userName })...` );
		console.info( '-'.repeat( 20 ) );
	}
};
