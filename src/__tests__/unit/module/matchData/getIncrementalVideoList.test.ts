import mockFs from 'mock-fs';
import type { Browser } from 'playwright';
import {
  getIncrementalVideoList,
  mergeSourceVideoList,
} from '../../../../module/matchData/getIncrementalVideoList.ts';
import { RecordStore } from '../../../../store/RecordStore.ts';
import { NormalizedPage } from '../../../../scraper/normalize.ts';
import { playwrightStreamPages } from '../../../../scraper/playwrightStreamPages.ts';
import {
  RecordItem,
  UnparseRecordItem,
  VideoSourceType,
} from '../../../../interface/IRecord.ts';

jest.mock('../../../../scraper/playwrightStreamPages.ts', () => ({
  playwrightStreamPages: jest.fn(),
}));

const mockStream = playwrightStreamPages as unknown as jest.Mock;
const fakeBrowser = {} as Browser;

describe('getIncrementalVideoList', () => {
  const testUid = 12345;
  const testUserName = 'TestUser';
  const dataDir = `data/${testUid}`;
  const testSeriesId = 91376;

  const createArchive = (
    aid: number,
    title: string,
    sourceType: VideoSourceType = 'upload',
    publishTime: number = 1700000000000,
  ): UnparseRecordItem => ({
    aid,
    bvId: `BV${aid}`,
    title,
    publishTime,
    liveDuration: 3600,
    sourceType,
  });

  const createPage = (
    archives: UnparseRecordItem[],
    options: {
      currentPage?: number;
      pageSize?: number;
      total?: number;
      sourceType?: VideoSourceType;
    } = {},
  ): NormalizedPage => {
    const sourceType = options.sourceType ?? 'upload';
    return {
      sourceType,
      currentPage: options.currentPage ?? 1,
      pageSize: options.pageSize ?? 100,
      total: options.total ?? archives.length,
      archives: archives.map(archive => ({ ...archive, sourceType })),
    };
  };

  /** 让生成器按顺序产出这些页 */
  const mockPages = (pages: NormalizedPage[]) => {
    mockStream.mockImplementation(async function* () {
      yield* pages;
    });
  };

  /** 按数据源分别产出页面，用于 both 模式 */
  const mockPagesBySource = (pagesBySource: Partial<Record<VideoSourceType, NormalizedPage[]>>) => {
    mockStream.mockImplementation(async function* (
      _browser: unknown,
      _uid: unknown,
      sourceType: VideoSourceType,
    ) {
      yield* pagesBySource[sourceType] ?? [];
    });
  };

  /** 模拟 onParse 之后的结果，新增记录需要 RecordItem 而不是采集出的 UnparseRecordItem */
  const toRecord = (item: UnparseRecordItem): RecordItem => ({
    ...item,
    liveTime: item.publishTime,
    playGame: [],
    liver: 'Test',
  });

  const createRecord = (aid: number, title: string): RecordItem => ({
    aid,
    bvId: `BV${aid}`,
    title,
    publishTime: 1700000000000,
    liveDuration: 3600,
    liveTime: 1700000000000,
    playGame: ['Game'],
    liver: 'Liver',
  });

  beforeEach(() => {
    mockFs({
      [dataDir]: {},
      node_modules: mockFs.load('node_modules'),
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe('生成器调用参数', () => {
    it('把 uid / 数据源类型 / seriesId / browser 透传给生成器', async () => {
      mockPages([]);
      const recordStore = new RecordStore(testUid, testUserName);

      await getIncrementalVideoList(
        testUid,
        'replay',
        testSeriesId,
        recordStore,
        fakeBrowser,
      );

      expect(mockStream).toHaveBeenCalledTimes(1);
      expect(mockStream).toHaveBeenCalledWith(fakeBrowser, testUid, 'replay', testSeriesId);
    });

    it('upload 模式只有一次采集', async () => {
      mockPages([]);
      const recordStore = new RecordStore(testUid, testUserName);

      await getIncrementalVideoList(testUid, 'upload', undefined, recordStore, fakeBrowser);

      expect(mockStream).toHaveBeenCalledTimes(1);
      expect(mockStream).toHaveBeenCalledWith(fakeBrowser, testUid, 'upload', undefined);
    });
  });

  describe('没有新增视频', () => {
    it('生成器不产出任何页时返回空数组', async () => {
      mockPages([]);
      const recordStore = new RecordStore(testUid, testUserName);

      const result = await getIncrementalVideoList(
        testUid, 'upload', undefined, recordStore, fakeBrowser,
      );

      expect(result).toEqual([]);
    });

    it('第一条视频就是缓存点时不收录任何视频', async () => {
      const recordStore = new RecordStore(testUid, testUserName);
      await recordStore.addRecord(createRecord(1001, 'Video 1'));

      mockPages([createPage([createArchive(1001, 'Video 1')])]);

      const result = await getIncrementalVideoList(
        testUid, 'upload', undefined, recordStore, fakeBrowser,
      );

      expect(result).toEqual([]);
    });
  });

  describe('在缓存点停止', () => {
    it('只收录缓存点之前的视频', async () => {
      const recordStore = new RecordStore(testUid, testUserName);
      await recordStore.addRecord(createRecord(1002, 'Video 2'));

      mockPages([createPage([
        createArchive(1001, 'Video 1'),
        createArchive(1002, 'Video 2'),
        createArchive(1003, 'Video 3'),
      ])]);

      const result = await getIncrementalVideoList(
        testUid, 'upload', undefined, recordStore, fakeBrowser,
      );

      expect(result.map(item => item.aid)).toEqual([1001]);
    });

    it('翻到第二页才命中缓存点', async () => {
      const recordStore = new RecordStore(testUid, testUserName);
      await recordStore.addRecord(createRecord(1003, 'Video 3'));

      mockPages([
        createPage(
          [createArchive(1001, 'Video 1'), createArchive(1002, 'Video 2')],
          { currentPage: 1, pageSize: 2, total: 5 },
        ),
        createPage(
          [createArchive(1003, 'Video 3'), createArchive(1004, 'Video 4')],
          { currentPage: 2, pageSize: 2, total: 5 },
        ),
        createPage(
          [createArchive(1005, 'Video 5')],
          { currentPage: 3, pageSize: 2, total: 5 },
        ),
      ]);

      const result = await getIncrementalVideoList(
        testUid, 'upload', undefined, recordStore, fakeBrowser,
      );

      expect(result.map(item => item.aid)).toEqual([1001, 1002]);
    });

    it('没有缓存点时把所有页都收下', async () => {
      const recordStore = new RecordStore(testUid, testUserName);

      mockPages([
        createPage(
          [createArchive(1001, 'Video 1'), createArchive(1002, 'Video 2')],
          { currentPage: 1, pageSize: 2, total: 3 },
        ),
        createPage(
          [createArchive(1003, 'Video 3')],
          { currentPage: 2, pageSize: 2, total: 3 },
        ),
      ]);

      const result = await getIncrementalVideoList(
        testUid, 'upload', undefined, recordStore, fakeBrowser,
      );

      expect(result.map(item => item.aid)).toEqual([1001, 1002, 1003]);
    });
  });

  describe('缓存点之后的标题变更', () => {
    it('标题变化时重新收录并标记 updateTime=false', async () => {
      const recordStore = new RecordStore(testUid, testUserName);
      await recordStore.addRecord(createRecord(1001, 'Old Title'));

      mockPages([createPage([createArchive(1001, 'Updated Title')])]);

      const result = await getIncrementalVideoList(
        testUid, 'upload', undefined, recordStore, fakeBrowser,
      );

      expect(result).toHaveLength(1);
      expect(result[0].aid).toBe(1001);
      expect(result[0].title).toBe('Updated Title');
      expect(result[0].updateTime).toBe(false);
    });

    it('标题没变时不收录', async () => {
      const recordStore = new RecordStore(testUid, testUserName);
      await recordStore.addRecord(createRecord(1001, 'Same Title'));

      mockPages([createPage([createArchive(1001, 'Same Title')])]);

      const result = await getIncrementalVideoList(
        testUid, 'upload', undefined, recordStore, fakeBrowser,
      );

      expect(result).toHaveLength(0);
    });

    it('同一页里缓存点之后的视频同样做标题比对', async () => {
      const recordStore = new RecordStore(testUid, testUserName);
      await recordStore.addRecord(
        createRecord(1001, 'Unchanged'),
        createRecord(1002, 'Old Title'),
      );

      mockPages([createPage([
        createArchive(1001, 'Unchanged'),
        createArchive(1002, 'Changed'),
        createArchive(1003, 'Video 3'),
      ])]);

      const result = await getIncrementalVideoList(
        testUid, 'upload', undefined, recordStore, fakeBrowser,
      );

      expect(result).toHaveLength(1);
      expect(result[0].aid).toBe(1002);
      expect(result[0].updateTime).toBe(false);
    });
  });

  describe('both 模式', () => {
    it('两个数据源各采集一次，按发布时间倒序归并', async () => {
      const recordStore = new RecordStore(testUid, testUserName);

      mockPagesBySource({
        upload: [
          createPage([createArchive(1001, 'Upload 1', 'upload', 1700000001000)], { sourceType: 'upload' }),
        ],
        replay: [
          createPage([createArchive(2001, 'Replay 1', 'replay', 1700000003000)], { sourceType: 'replay' }),
        ],
      });

      const result = await getIncrementalVideoList(
        testUid, 'both', testSeriesId, recordStore, fakeBrowser,
      );

      expect(mockStream).toHaveBeenCalledTimes(2);
      expect(mockStream).toHaveBeenNthCalledWith(1, fakeBrowser, testUid, 'upload', testSeriesId);
      expect(mockStream).toHaveBeenNthCalledWith(2, fakeBrowser, testUid, 'replay', testSeriesId);
      // 最新的排在最前，addRecord 依赖这个顺序推进缓存点
      expect(result.map(item => item.aid)).toEqual([2001, 1001]);
    });

    it('两个数据源各自独立命中自己的缓存点', async () => {
      const recordStore = new RecordStore(testUid, testUserName);
      // 带 sourceType 写入，模拟上一次运行留下的分源缓存点
      await recordStore.addRecord({ ...createRecord(1002, 'Upload 2'), sourceType: 'upload' });
      await recordStore.addRecord({ ...createRecord(2002, 'Replay 2'), sourceType: 'replay' });

      mockPagesBySource({
        upload: [
          createPage([
            createArchive(1001, 'Upload 1', 'upload', 1700000005000),
            createArchive(1002, 'Upload 2', 'upload', 1700000004000),
          ], { sourceType: 'upload' }),
        ],
        replay: [
          createPage([
            createArchive(2001, 'Replay 1', 'replay', 1700000003000),
            createArchive(2002, 'Replay 2', 'replay', 1700000002000),
          ], { sourceType: 'replay' }),
        ],
      });

      const result = await getIncrementalVideoList(
        testUid, 'both', testSeriesId, recordStore, fakeBrowser,
      );

      // 两个源各自在缓存点停下，互不影响
      expect(result.map(item => item.aid).sort()).toEqual([1001, 2001]);
    });

    it('按 aid 去重', async () => {
      const recordStore = new RecordStore(testUid, testUserName);

      mockPagesBySource({
        upload: [ createPage([createArchive(1001, 'Upload', 'upload')], { sourceType: 'upload' }) ],
        replay: [ createPage([createArchive(1001, 'Replay', 'replay')], { sourceType: 'replay' }) ],
      });

      const result = await getIncrementalVideoList(
        testUid, 'both', testSeriesId, recordStore, fakeBrowser,
      );

      expect(result).toHaveLength(1);
      expect(result[0].aid).toBe(1001);
    });
  });

  describe('分源缓存点的维护', () => {
    it('采集成功写入后记录该数据源的缓存点', async () => {
      const recordStore = new RecordStore(testUid, testUserName);
      mockPages([createPage([createArchive(1001, 'Video 1')])]);

      const list = await getIncrementalVideoList(
        testUid, 'upload', undefined, recordStore, fakeBrowser,
      );
      await recordStore.addRecord(...list.map(toRecord));

      expect(recordStore.cache.aidBySource).toEqual({ upload: 1001 });
      // sourceType 是临时字段，不进 record.json
      expect(recordStore.recordList[0]).not.toHaveProperty('sourceType');
    });

    it('both 模式记录各自数据源的缓存点', async () => {
      const recordStore = new RecordStore(testUid, testUserName);
      mockPagesBySource({
        upload: [ createPage([createArchive(1001, 'Upload', 'upload', 1700000001000)], { sourceType: 'upload' }) ],
        replay: [ createPage([createArchive(2001, 'Replay', 'replay', 1700000003000)], { sourceType: 'replay' }) ],
      });

      const list = await getIncrementalVideoList(
        testUid, 'both', testSeriesId, recordStore, fakeBrowser,
      );
      await recordStore.addRecord(...list.map(toRecord));

      expect(recordStore.cache.aidBySource).toEqual({ upload: 1001, replay: 2001 });
      // 标量 aid 保持旧语义：本轮最新的一条
      expect(recordStore.cache.aid).toBe(2001);
    });
  });
});

describe('mergeSourceVideoList', () => {
  const createItem = (aid: number, publishTime: number, title = `Video ${aid}`): UnparseRecordItem => ({
    aid,
    bvId: `BV${aid}`,
    title,
    publishTime,
    liveDuration: 3600,
    sourceType: 'upload',
  });

  it('按发布时间倒序排列', () => {
    const merged = mergeSourceVideoList([
      createItem(1, 1000),
      createItem(2, 3000),
      createItem(3, 2000),
    ]);

    expect(merged.map(item => item.aid)).toEqual([2, 3, 1]);
  });

  it('aid 重复时保留先出现的那条', () => {
    const merged = mergeSourceVideoList([
      createItem(1, 1000, 'first'),
      createItem(1, 1000, 'second'),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('first');
  });

  it('空数组返回空数组', () => {
    expect(mergeSourceVideoList([])).toEqual([]);
  });
});
