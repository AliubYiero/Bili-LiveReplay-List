import { RecordItem, UnparseRecordItem } from '../../interface/IRecord.ts';
import { RecordStore } from '../../store/RecordStore.ts';
import { getIncrementalVideoList } from './getIncrementalVideoList.ts';
import { IParseItem } from './handleParseMapper.ts';

export const matchVideoList = async (
	uid: number,
	userName: string,
	onParse: IParseItem['onParse'],
) => {
	console.info( `正在读取用户 ${ userName }(uid:${ uid }) 的投稿视频列表:` );
	const configStore = new RecordStore( uid, userName );
	const unparseVideoList = await getIncrementalVideoList( uid, configStore );
	const videoList = ( await Promise.all( unparseVideoList.map( onParse ) ) )
		.filter( Boolean ) as RecordItem[];
	configStore.addRecord( ...videoList );
	console.info( `用户 ${ userName }(uid:${ uid }) 更新了 ${ videoList.length } 个视频` );
	console.info( '-'.repeat( 20 ) );
	return Boolean( videoList.length );
};
