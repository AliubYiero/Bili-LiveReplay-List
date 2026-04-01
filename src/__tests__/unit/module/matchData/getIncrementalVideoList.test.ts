import mockFs from 'mock-fs';
import { getIncrementalVideoList } from '../../../../module/matchData/getIncrementalVideoList.ts';
import { RecordStore } from '../../../../store/RecordStore.ts';
import * as apiModule from '../../../../api/api_getUserUploadVideoList.ts';
import * as radash from 'radash';
import { archiveItem } from '../../../../interface/IUserUploadVideo.ts';

// Mock api module
jest.mock('../../../../api/api_getUserUploadVideoList.ts');

// Mock radash sleep
jest.mock('radash', () => ({
  ...jest.requireActual('radash'),
  sleep: jest.fn().mockResolvedValue(undefined),
}));

describe('getIncrementalVideoList', () => {
  const testUid = 12345;
  const testUserName = 'TestUser';
  const dataDir = `data/${testUid}`;

  // Helper function to create mock archive items
  const createMockArchive = (
    aid: number,
    bvid: string,
    title: string,
    pubdate: number = 1700000000,
    duration: number = 3600
  ): archiveItem => ({
    aid,
    bvid,
    title,
    desc: 'Test description',
    pic: 'http://example.com/pic.jpg',
    pubdate,
    ctime: pubdate,
    duration,
    state: 0,
    upMid: testUid,
    stat: { view: 1000 },
    enable_vt: 0,
    ugc_pay: 0,
    playback_position: 0,
    vt_display: '',
    interactive_video: false,
  });

  // Helper function to create mock API response
  const createMockResponse = (
    archives: archiveItem[],
    pageNum: number = 1,
    pageSize: number = 100,
    total: number = archives.length
  ) => ({
    archives,
    page: {
      num: pageNum,
      size: pageSize,
      total,
    },
    hasNext: pageNum * pageSize < total,
  });

  beforeEach(() => {
    // Setup mock file system - include node_modules to allow Jest to work
    mockFs({
      [dataDir]: {},
      'node_modules': mockFs.load('node_modules'),
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe('should return empty array when no new videos', () => {
    it('when API returns empty archives', async () => {
      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValue(createMockResponse([]));

      const recordStore = new RecordStore(testUid, testUserName);
      const result = await getIncrementalVideoList(testUid, recordStore);

      expect(result).toEqual([]);
      expect(mockApi).toHaveBeenCalledTimes(1);
      expect(mockApi).toHaveBeenCalledWith(testUid, 1, 100);
    });

    it('when first video matches cache point', async () => {
      const archive1 = createMockArchive(1001, 'BV1001', 'Video 1');
      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValue(createMockResponse([archive1]));

      const recordStore = new RecordStore(testUid, testUserName);
      // Pre-set cache to match the first video
      await recordStore.addRecord({
        aid: 1001,
        bvId: 'BV1001',
        title: 'Video 1',
        publishTime: 1700000000000,
        liveDuration: 3600,
        liveTime: 1700000000000,
        playGame: ['Game'],
        liver: 'Liver',
      });

      const result = await getIncrementalVideoList(testUid, recordStore);

      expect(result).toEqual([]);
      expect(mockApi).toHaveBeenCalledTimes(1);
    });
  });

  describe('should fetch videos until cache point', () => {
    it('stop when arrivedCachePoint returns true', async () => {
      const archive1 = createMockArchive(1001, 'BV1001', 'Video 1');
      const archive2 = createMockArchive(1002, 'BV1002', 'Video 2');
      const archive3 = createMockArchive(1003, 'BV1003', 'Video 3');

      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValueOnce(createMockResponse([archive1, archive2, archive3], 1, 100, 3));

      const recordStore = new RecordStore(testUid, testUserName);
      // Pre-set cache to match archive2
      await recordStore.addRecord({
        aid: 1002,
        bvId: 'BV1002',
        title: 'Video 2',
        publishTime: 1700000000000,
        liveDuration: 3600,
        liveTime: 1700000000000,
        playGame: ['Game'],
        liver: 'Liver',
      });

      const result = await getIncrementalVideoList(testUid, recordStore);

      // Should only include archive1, stop at archive2 (cache point)
      expect(result).toHaveLength(1);
      expect(result[0].aid).toBe(1001);
      expect(mockApi).toHaveBeenCalledTimes(1);
    });

    it('fetch multiple pages before hitting cache point', async () => {
      const page1Archives = [
        createMockArchive(1001, 'BV1001', 'Video 1'),
        createMockArchive(1002, 'BV1002', 'Video 2'),
      ];
      const page2Archives = [
        createMockArchive(1003, 'BV1003', 'Video 3'),
        createMockArchive(1004, 'BV1004', 'Video 4'),
      ];

      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValueOnce(createMockResponse(page1Archives, 1, 2, 5))
        .mockResolvedValueOnce(createMockResponse(page2Archives, 2, 2, 5));

      const recordStore = new RecordStore(testUid, testUserName);
      // Cache point at aid 1003 (in page 2)
      // When 1003 is found, hasNextPage is set to false, and checkCache becomes true
      // 1003 has same title -> excluded, 1004 is processed with checkCache=true but not in store -> excluded
      await recordStore.addRecord({
        aid: 1003,
        bvId: 'BV1003',
        title: 'Video 3',
        publishTime: 1700000000000,
        liveDuration: 3600,
        liveTime: 1700000000000,
        playGame: ['Game'],
        liver: 'Liver',
      });

      const result = await getIncrementalVideoList(testUid, recordStore);

      // Only videos before cache point are included
      expect(result).toHaveLength(2);
      expect(result.map(r => r.aid)).toEqual([1001, 1002]);
      expect(mockApi).toHaveBeenCalledTimes(2);
    });
  });

  describe('should handle video title changes', () => {
    it('include video with changed title and set updateTime to false', async () => {
      const archive1 = createMockArchive(1001, 'BV1001', 'Updated Title');

      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValue(createMockResponse([archive1]));

      const recordStore = new RecordStore(testUid, testUserName);
      // Pre-existing record with different title (cache point)
      await recordStore.addRecord({
        aid: 1001,
        bvId: 'BV1001',
        title: 'Old Title',
        publishTime: 1700000000000,
        liveDuration: 3600,
        liveTime: 1700000000000,
        playGame: ['Game'],
        liver: 'Liver',
      });

      const result = await getIncrementalVideoList(testUid, recordStore);

      expect(result).toHaveLength(1);
      expect(result[0].aid).toBe(1001);
      expect(result[0].title).toBe('Updated Title');
      expect(result[0].updateTime).toBe(false);
    });

    it('exclude video when title is unchanged', async () => {
      const archive1 = createMockArchive(1001, 'BV1001', 'Same Title');

      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValue(createMockResponse([archive1]));

      const recordStore = new RecordStore(testUid, testUserName);
      // Pre-existing record with same title at aid 1001 (cache point)
      await recordStore.addRecord({
        aid: 1001,
        bvId: 'BV1001',
        title: 'Same Title',
        publishTime: 1700000000000,
        liveDuration: 3600,
        liveTime: 1700000000000,
        playGame: ['Game'],
        liver: 'Liver',
      });

      const result = await getIncrementalVideoList(testUid, recordStore);

      // archive1 is cache point with same title -> excluded, no new videos
      expect(result).toHaveLength(0);
    });

    it('handle mix of changed and unchanged titles at cache point', async () => {
      const archive1 = createMockArchive(1001, 'BV1001', 'Video 1');
      const archive2 = createMockArchive(1002, 'BV1002', 'Changed Title');
      const archive3 = createMockArchive(1003, 'BV1003', 'Video 3');

      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValue(createMockResponse([archive1, archive2, archive3]));

      const recordStore = new RecordStore(testUid, testUserName);
      // Cache point at aid 1002
      await recordStore.addRecord({
        aid: 1002,
        bvId: 'BV1002',
        title: 'Old Title',
        publishTime: 1700000000000,
        liveDuration: 3600,
        liveTime: 1700000000000,
        playGame: ['Game'],
        liver: 'Liver',
      });

      const result = await getIncrementalVideoList(testUid, recordStore);

      expect(result).toHaveLength(2);
      expect(result[0].aid).toBe(1001);
      expect(result[1].aid).toBe(1002);
      expect(result[1].updateTime).toBe(false);
    });
  });

  describe('should respect MAX_PAGES limit', () => {
    it('stop when page exceeds MAX_PAGES', async () => {
      // Create 101 pages of data (more than MAX_PAGES = 100)
      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockImplementation((uid: number, page) => {
          return Promise.resolve(createMockResponse(
            [createMockArchive(1000 + (page || 1), `BV${1000 + (page || 1)}`, `Video ${page}`)],
            page,
            1,
            200
          ));
        });

      const recordStore = new RecordStore(testUid, testUserName);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await getIncrementalVideoList(testUid, recordStore);

      // Should have fetched 100 pages (MAX_PAGES)
      expect(mockApi).toHaveBeenCalledTimes(100);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('超过最大限制 100')
      );
      expect(result).toHaveLength(100);

      consoleSpy.mockRestore();
    });

    it('stop early when hasNext is false', async () => {
      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValueOnce(createMockResponse(
          [createMockArchive(1001, 'BV1001', 'Video 1')],
          1,
          100,
          1 // total = 1, so no next page
        ));

      const recordStore = new RecordStore(testUid, testUserName);
      const result = await getIncrementalVideoList(testUid, recordStore);

      expect(mockApi).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('should handle multi-page data fetching', () => {
    it('fetch all pages when no cache point hit', async () => {
      const page1Archives = [
        createMockArchive(1001, 'BV1001', 'Video 1'),
        createMockArchive(1002, 'BV1002', 'Video 2'),
      ];
      const page2Archives = [
        createMockArchive(1003, 'BV1003', 'Video 3'),
        createMockArchive(1004, 'BV1004', 'Video 4'),
      ];
      const page3Archives = [
        createMockArchive(1005, 'BV1005', 'Video 5'),
      ];

      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValueOnce(createMockResponse(page1Archives, 1, 2, 5))
        .mockResolvedValueOnce(createMockResponse(page2Archives, 2, 2, 5))
        .mockResolvedValueOnce(createMockResponse(page3Archives, 3, 2, 5));

      const recordStore = new RecordStore(testUid, testUserName);
      const result = await getIncrementalVideoList(testUid, recordStore);

      expect(result).toHaveLength(5);
      expect(result.map(r => r.aid)).toEqual([1001, 1002, 1003, 1004, 1005]);
      expect(mockApi).toHaveBeenCalledTimes(3);
      expect(mockApi).toHaveBeenNthCalledWith(1, testUid, 1, 100);
      expect(mockApi).toHaveBeenNthCalledWith(2, testUid, 2, 100);
      expect(mockApi).toHaveBeenNthCalledWith(3, testUid, 3, 100);
    });

    it('parse archive data correctly', async () => {
      const archive = createMockArchive(
        12345,
        'BV1Test',
        'Test Video Title',
        1700000000,
        7200
      );

      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValue(createMockResponse([archive]));

      const recordStore = new RecordStore(testUid, testUserName);
      const result = await getIncrementalVideoList(testUid, recordStore);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        aid: 12345,
        bvId: 'BV1Test',
        title: 'Test Video Title',
        liveDuration: 7200,
        publishTime: 1700000000000, // converted from seconds to milliseconds
      });
    });
  });

  describe('should handle checkCacheVideoTitle returning true', () => {
    it('exclude video when checkCacheVideoTitle returns true', async () => {
      const archive1 = createMockArchive(1001, 'BV1001', 'Same Title');

      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValue(createMockResponse([archive1]));

      const recordStore = new RecordStore(testUid, testUserName);
      await recordStore.addRecord({
        aid: 1001,
        bvId: 'BV1001',
        title: 'Same Title',
        publishTime: 1700000000000,
        liveDuration: 3600,
        liveTime: 1700000000000,
        playGame: ['Game'],
        liver: 'Liver',
      });

      const result = await getIncrementalVideoList(testUid, recordStore);

      // When checkCacheVideoTitle returns true, video should be excluded
      expect(result).toHaveLength(0);
    });

    it('continue processing after finding unchanged video', async () => {
      const archive1 = createMockArchive(1001, 'BV1001', 'Unchanged');
      const archive2 = createMockArchive(1002, 'BV1002', 'Changed');

      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValue(createMockResponse([archive1, archive2]));

      const recordStore = new RecordStore(testUid, testUserName);
      // Add both records in single call - first record's aid becomes cache.aid
      // We want cache.aid to be 1001, so archive1 should be first in the array
      await recordStore.addRecord(
        {
          aid: 1001,
          bvId: 'BV1001',
          title: 'Unchanged',
          publishTime: 1700000000000,
          liveDuration: 3600,
          liveTime: 1700000000000,
          playGame: ['Game'],
          liver: 'Liver',
        },
        {
          aid: 1002,
          bvId: 'BV1002',
          title: 'Old Title',
          publishTime: 1700000000000,
          liveDuration: 3600,
          liveTime: 1700000000000,
          playGame: ['Game'],
          liver: 'Liver',
        }
      );

      const result = await getIncrementalVideoList(testUid, recordStore);

      // archive1 is at cache point (aid=1001) with unchanged title -> excluded
      // archive2 has changed title -> included with updateTime=false
      expect(result).toHaveLength(1);
      expect(result[0].aid).toBe(1002);
      expect(result[0].updateTime).toBe(false);
    });
  });

  describe('should call sleep between API requests', () => {
    it('call sleep with 20_000ms delay', async () => {
      jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValue(createMockResponse([]));

      const recordStore = new RecordStore(testUid, testUserName);
      await getIncrementalVideoList(testUid, recordStore);

      expect(radash.sleep).toHaveBeenCalledWith(20_000);
    });
  });

  describe('should log progress information', () => {
    it('log page progress for each request', async () => {
      const mockApi = jest.spyOn(apiModule, 'api_getUserUploadVideoList')
        .mockResolvedValueOnce(createMockResponse(
          [createMockArchive(1001, 'BV1001', 'Video 1')],
          1,
          100,
          150
        ))
        .mockResolvedValueOnce(createMockResponse(
          [createMockArchive(1002, 'BV1002', 'Video 2')],
          2,
          100,
          150
        ));

      const recordStore = new RecordStore(testUid, testUserName);
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      await getIncrementalVideoList(testUid, recordStore);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Page 1 / 2')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Page 2 / 2')
      );

      consoleSpy.mockRestore();
    });
  });
});
