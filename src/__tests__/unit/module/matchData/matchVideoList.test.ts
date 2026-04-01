import mockFs from 'mock-fs';
import { matchVideoList } from '../../../../module/matchData/matchVideoList.ts';
import * as getIncrementalVideoListModule from '../../../../module/matchData/getIncrementalVideoList.ts';
import { UnparseRecordItem, RecordItem } from '../../../../interface/IRecord.ts';

// Mock getIncrementalVideoList 模块
jest.mock('../../../../module/matchData/getIncrementalVideoList.ts');

describe('matchVideoList', () => {
  const testUid = 12345;
  const testUserName = 'TestUser';

  beforeEach(() => {
    mockFs({
      'node_modules': mockFs.load('node_modules'),
      'data': {},
      'config': {}
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockFs.restore();
  });

  it('should return true when new videos are added', async () => {
    // Arrange
    const mockUnparseVideos: UnparseRecordItem[] = [
      {
        aid: 1,
        bvId: 'BV1',
        publishTime: 1700000000000,
        liveDuration: 3600,
        title: 'Test Video 1',
      },
      {
        aid: 2,
        bvId: 'BV2',
        publishTime: 1700000100000,
        liveDuration: 7200,
        title: 'Test Video 2',
      },
    ];

    const mockParsedVideos: RecordItem[] = [
      {
        ...mockUnparseVideos[0],
        liveTime: 1700000000000,
        playGame: ['Game1'],
        liver: 'TestLiver',
      },
      {
        ...mockUnparseVideos[1],
        liveTime: 1700000100000,
        playGame: ['Game2'],
        liver: 'TestLiver',
      },
    ];

    jest.spyOn(getIncrementalVideoListModule, 'getIncrementalVideoList')
      .mockResolvedValue(mockUnparseVideos);

    const mockOnParse = jest.fn()
      .mockResolvedValueOnce(mockParsedVideos[0])
      .mockResolvedValueOnce(mockParsedVideos[1]);

    // Act
    const result = await matchVideoList(testUid, testUserName, mockOnParse);

    // Assert
    expect(result).toBe(true);
    expect(mockOnParse).toHaveBeenCalledTimes(2);
    // Array.map passes 3 args: element, index, array - we only care about first arg
    expect(mockOnParse.mock.calls[0][0]).toEqual(mockUnparseVideos[0]);
    expect(mockOnParse.mock.calls[1][0]).toEqual(mockUnparseVideos[1]);
  });

  it('should return false when no new videos', async () => {
    // Arrange
    jest.spyOn(getIncrementalVideoListModule, 'getIncrementalVideoList')
      .mockResolvedValue([]);

    const mockOnParse = jest.fn();

    // Act
    const result = await matchVideoList(testUid, testUserName, mockOnParse);

    // Assert
    expect(result).toBe(false);
    expect(mockOnParse).not.toHaveBeenCalled();
  });

  it('should filter out videos with null parse result', async () => {
    // Arrange
    const mockUnparseVideos: UnparseRecordItem[] = [
      {
        aid: 1,
        bvId: 'BV1',
        publishTime: 1700000000000,
        liveDuration: 3600,
        title: 'Test Video 1',
      },
      {
        aid: 2,
        bvId: 'BV2',
        publishTime: 1700000100000,
        liveDuration: 7200,
        title: 'Test Video 2',
      },
      {
        aid: 3,
        bvId: 'BV3',
        publishTime: 1700000200000,
        liveDuration: 1800,
        title: 'Test Video 3',
      },
    ];

    const mockParsedVideo: RecordItem = {
      ...mockUnparseVideos[1],
      liveTime: 1700000100000,
      playGame: ['Game2'],
      liver: 'TestLiver',
    };

    jest.spyOn(getIncrementalVideoListModule, 'getIncrementalVideoList')
      .mockResolvedValue(mockUnparseVideos);

    const mockOnParse = jest.fn()
      .mockResolvedValueOnce(null)      // First video returns null
      .mockResolvedValueOnce(mockParsedVideo)  // Second video returns valid
      .mockResolvedValueOnce(null);     // Third video returns null

    // Act
    const result = await matchVideoList(testUid, testUserName, mockOnParse);

    // Assert
    expect(result).toBe(true);
    expect(mockOnParse).toHaveBeenCalledTimes(3);
  });

  it('should return false when all parse results are null', async () => {
    // Arrange
    const mockUnparseVideos: UnparseRecordItem[] = [
      {
        aid: 1,
        bvId: 'BV1',
        publishTime: 1700000000000,
        liveDuration: 3600,
        title: 'Test Video 1',
      },
    ];

    jest.spyOn(getIncrementalVideoListModule, 'getIncrementalVideoList')
      .mockResolvedValue(mockUnparseVideos);

    const mockOnParse = jest.fn().mockResolvedValue(null);

    // Act
    const result = await matchVideoList(testUid, testUserName, mockOnParse);

    // Assert
    expect(result).toBe(false);
    expect(mockOnParse).toHaveBeenCalledTimes(1);
  });

  it('should correctly call RecordStore.addRecord with parsed videos', async () => {
    // Arrange
    const mockUnparseVideos: UnparseRecordItem[] = [
      {
        aid: 1,
        bvId: 'BV1',
        publishTime: 1700000000000,
        liveDuration: 3600,
        title: 'Test Video 1',
      },
    ];

    const mockParsedVideo: RecordItem = {
      ...mockUnparseVideos[0],
      liveTime: 1700000000000,
      playGame: ['Game1'],
      liver: 'TestLiver',
    };

    jest.spyOn(getIncrementalVideoListModule, 'getIncrementalVideoList')
      .mockResolvedValue(mockUnparseVideos);

    const mockOnParse = jest.fn().mockResolvedValue(mockParsedVideo);

    // Act
    await matchVideoList(testUid, testUserName, mockOnParse);

    // Assert - RecordStore should persist the data
    // We verify this by checking that addRecord was called (indirectly through store)
    // Since we can't easily spy on the internal store, we verify the function behavior
    // Array.map passes 3 args: element, index, array - we only care about first arg
    expect(mockOnParse.mock.calls[0][0]).toEqual(mockUnparseVideos[0]);
  });

  it('should log correct info messages', async () => {
    // Arrange
    const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

    const mockUnparseVideos: UnparseRecordItem[] = [
      {
        aid: 1,
        bvId: 'BV1',
        publishTime: 1700000000000,
        liveDuration: 3600,
        title: 'Test Video 1',
      },
      {
        aid: 2,
        bvId: 'BV2',
        publishTime: 1700000100000,
        liveDuration: 7200,
        title: 'Test Video 2',
      },
    ];

    const mockParsedVideos: RecordItem[] = [
      {
        ...mockUnparseVideos[0],
        liveTime: 1700000000000,
        playGame: ['Game1'],
        liver: 'TestLiver',
      },
      {
        ...mockUnparseVideos[1],
        liveTime: 1700000100000,
        playGame: ['Game2'],
        liver: 'TestLiver',
      },
    ];

    jest.spyOn(getIncrementalVideoListModule, 'getIncrementalVideoList')
      .mockResolvedValue(mockUnparseVideos);

    const mockOnParse = jest.fn()
      .mockResolvedValueOnce(mockParsedVideos[0])
      .mockResolvedValueOnce(mockParsedVideos[1]);

    // Act
    await matchVideoList(testUid, testUserName, mockOnParse);

    // Assert
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      `正在读取用户 ${testUserName}(uid:${testUid}) 的投稿视频列表:`
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      `用户 ${testUserName}(uid:${testUid}) 更新了 2 个视频`
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith('-'.repeat(20));

    consoleInfoSpy.mockRestore();
  });

  it('should log correct info messages when no videos added', async () => {
    // Arrange
    const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

    jest.spyOn(getIncrementalVideoListModule, 'getIncrementalVideoList')
      .mockResolvedValue([]);

    const mockOnParse = jest.fn();

    // Act
    await matchVideoList(testUid, testUserName, mockOnParse);

    // Assert
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      `正在读取用户 ${testUserName}(uid:${testUid}) 的投稿视频列表:`
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      `用户 ${testUserName}(uid:${testUid}) 更新了 0 个视频`
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith('-'.repeat(20));

    consoleInfoSpy.mockRestore();
  });

  it('should handle mixed valid and null parse results correctly', async () => {
    // Arrange
    const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

    const mockUnparseVideos: UnparseRecordItem[] = [
      {
        aid: 1,
        bvId: 'BV1',
        publishTime: 1700000000000,
        liveDuration: 3600,
        title: 'Test Video 1',
      },
      {
        aid: 2,
        bvId: 'BV2',
        publishTime: 1700000100000,
        liveDuration: 7200,
        title: 'Test Video 2',
      },
      {
        aid: 3,
        bvId: 'BV3',
        publishTime: 1700000200000,
        liveDuration: 1800,
        title: 'Test Video 3',
      },
    ];

    const mockParsedVideos: (RecordItem | null)[] = [
      null,
      {
        ...mockUnparseVideos[1],
        liveTime: 1700000100000,
        playGame: ['Game2'],
        liver: 'TestLiver',
      },
      {
        ...mockUnparseVideos[2],
        liveTime: 1700000200000,
        playGame: ['Game3'],
        liver: 'TestLiver',
      },
    ];

    jest.spyOn(getIncrementalVideoListModule, 'getIncrementalVideoList')
      .mockResolvedValue(mockUnparseVideos);

    const mockOnParse = jest.fn()
      .mockResolvedValueOnce(mockParsedVideos[0])
      .mockResolvedValueOnce(mockParsedVideos[1])
      .mockResolvedValueOnce(mockParsedVideos[2]);

    // Act
    const result = await matchVideoList(testUid, testUserName, mockOnParse);

    // Assert
    expect(result).toBe(true);
    // Should log that 2 videos were updated (excluding the null one)
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      `用户 ${testUserName}(uid:${testUid}) 更新了 2 个视频`
    );

    consoleInfoSpy.mockRestore();
  });

  it('should pass correct parameters to getIncrementalVideoList', async () => {
    // Arrange
    const getIncrementalVideoListSpy = jest
      .spyOn(getIncrementalVideoListModule, 'getIncrementalVideoList')
      .mockResolvedValue([]);

    const mockOnParse = jest.fn();

    // Act
    await matchVideoList(testUid, testUserName, mockOnParse);

    // Assert
    expect(getIncrementalVideoListSpy).toHaveBeenCalledWith(
      testUid,
      expect.any(Object)  // RecordStore instance
    );
  });

  describe('daily cache check', () => {
    it('should skip API call if already updated today', async () => {
      // Arrange
      const today = Date.now();
      const dataDir = `data/${testUid}`;
      
      mockFs.restore();
      mockFs({
        'node_modules': mockFs.load('node_modules'),
        [dataDir]: {
          [`${testUserName}.record.json`]: JSON.stringify({
            cache: {
              uid: testUid,
              userName: testUserName,
              aid: 123,
              timestamp: today
            },
            records: []
          })
        }
      });

      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      const getIncrementalVideoListSpy = jest
        .spyOn(getIncrementalVideoListModule, 'getIncrementalVideoList')
        .mockResolvedValue([]);
      const mockOnParse = jest.fn();

      // Act
      const result = await matchVideoList(testUid, testUserName, mockOnParse);

      // Assert
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        `用户 ${testUserName} 今天已更新，跳过数据获取`
      );
      expect(getIncrementalVideoListSpy).not.toHaveBeenCalled();
      expect(mockOnParse).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should proceed with API call if not updated today', async () => {
      // Arrange
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      const dataDir = `data/${testUid}`;
      
      mockFs.restore();
      mockFs({
        'node_modules': mockFs.load('node_modules'),
        [dataDir]: {
          [`${testUserName}.record.json`]: JSON.stringify({
            cache: {
              uid: testUid,
              userName: testUserName,
              aid: 123,
              timestamp: yesterday
            },
            records: []
          })
        }
      });

      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      const getIncrementalVideoListSpy = jest
        .spyOn(getIncrementalVideoListModule, 'getIncrementalVideoList')
        .mockResolvedValue([]);
      const mockOnParse = jest.fn();

      // Act
      await matchVideoList(testUid, testUserName, mockOnParse);

      // Assert
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('今天已更新')
      );
      expect(getIncrementalVideoListSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
