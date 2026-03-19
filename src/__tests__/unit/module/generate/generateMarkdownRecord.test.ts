import mockFs from 'mock-fs';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { cwd } from 'process';
import { generateMarkdownRecord } from '../../../../module/generate/generateMarkdownRecord.ts';
import { RecordStore } from '../../../../store/RecordStore.ts';
import { RecordItem } from '../../../../interface/IRecord.ts';

describe('generateMarkdownRecord', () => {
  const testUid = 12345;
  const testUserName = 'TestUploader';
  const testTimestamp = 1700000000000;

  // 模拟 console.info 避免输出干扰
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    mockFs.restore();
    consoleInfoSpy.mockRestore();
  });

  /**
   * 创建测试用的 RecordStore 数据
   */
  const createMockRecordStore = (records: RecordItem[]) => {
    return {
      cache: {
        uid: testUid,
        userName: testUserName,
        aid: 0,
        timestamp: testTimestamp,
      },
      recordList: records,
    };
  };

  describe('single liver processing', () => {
    beforeEach(() => {
      mockFs({
        data: {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({}),
          },
          'SpellingCorrections.json': JSON.stringify({
            version: '2.0',
            global: { rules: [] },
            uidRules: {},
          }),
        },
        docx: {},
      });
    });

    it('should generate markdown for single liver with single video', () => {
      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Test Video Title',
          liveTime: 1700000000000,
          playGame: ['TestGame'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      // 验证文件被创建
      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      expect(existsSync(expectedFilePath)).toBe(true);

      // 验证文件内容包含关键信息
      const content = readFileSync(expectedFilePath, 'utf-8');
      expect(content).toContain('TestLiver 直播回放');
      expect(content).toContain(testUserName);
      expect(content).toContain('Test Video Title');
      expect(content).toContain('TestGame');
      expect(content).toContain('1001');
    });

    it('should sort videos by publishTime in descending order', () => {
      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1000,
          liveDuration: 3600,
          title: 'Oldest Video',
          liveTime: 1700000000000,
          playGame: ['Game1'],
          liver: 'TestLiver',
        },
        {
          aid: 1003,
          bvId: 'BV1003',
          publishTime: 3000,
          liveDuration: 3600,
          title: 'Latest Video',
          liveTime: 1700000000000,
          playGame: ['Game1'],
          liver: 'TestLiver',
        },
        {
          aid: 1002,
          bvId: 'BV1002',
          publishTime: 2000,
          liveDuration: 3600,
          title: 'Middle Video',
          liveTime: 1700000000000,
          playGame: ['Game1'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // 验证最旧和最新视频信息在头部正确显示
      // 注意：在 Markdown 表格中，最旧视频在前，最新视频在后
      const oldestVideoLink = content.indexOf('https://www.bilibili.com/video/av1001/');
      const latestVideoLink = content.indexOf('https://www.bilibili.com/video/av1003/');

      expect(latestVideoLink).toBeGreaterThan(0);
      expect(oldestVideoLink).toBeGreaterThan(0);
      expect(oldestVideoLink).toBeLessThan(latestVideoLink);

      // 验证最旧和最新视频标签
      expect(content).toContain('**最新视频**');
      expect(content).toContain('**最旧视频**');

      // 在游戏列表中，视频顺序会被 reverse() 反转（从旧到新）
      // 所以 Middle Video (aid 1002) 应该比 Latest Video (aid 1003) 先出现
      const gameSection = content.substring(content.indexOf('## Game1'));
      const middleInGame = gameSection.indexOf('Middle Video');
      const latestInGame = gameSection.indexOf('Latest Video');
      expect(middleInGame).toBeLessThan(latestInGame);
    });
  });

  describe('multiple livers grouping', () => {
    beforeEach(() => {
      mockFs({
        data: {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({}),
          },
          'SpellingCorrections.json': JSON.stringify({
            version: '2.0',
            global: { rules: [] },
            uidRules: {},
          }),
        },
        docx: {},
      });
    });

    it('should group records by liver and generate separate markdown files', () => {
      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Video from Liver1',
          liveTime: 1700000000000,
          playGame: ['GameA'],
          liver: 'Liver1',
        },
        {
          aid: 1002,
          bvId: 'BV1002',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Video from Liver2',
          liveTime: 1700000000000,
          playGame: ['GameB'],
          liver: 'Liver2',
        },
        {
          aid: 1003,
          bvId: 'BV1003',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Another from Liver1',
          liveTime: 1700000000000,
          playGame: ['GameC'],
          liver: 'Liver1',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      // 验证 Liver1 的文件
      const liver1Path = resolve(
        cwd(),
        'docx',
        'Liver1',
        `Liver1直播回放列表(from ${testUserName}).md`
      );
      expect(existsSync(liver1Path)).toBe(true);
      const liver1Content = readFileSync(liver1Path, 'utf-8');
      expect(liver1Content).toContain('Video from Liver1');
      expect(liver1Content).toContain('Another from Liver1');
      expect(liver1Content).toContain('**累积计入视频数量** | **2**');

      // 验证 Liver2 的文件
      const liver2Path = resolve(
        cwd(),
        'docx',
        'Liver2',
        `Liver2直播回放列表(from ${testUserName}).md`
      );
      expect(existsSync(liver2Path)).toBe(true);
      const liver2Content = readFileSync(liver2Path, 'utf-8');
      expect(liver2Content).toContain('Video from Liver2');
      expect(liver2Content).toContain('**累积计入视频数量** | **1**');
    });

    it('should log generation info for each liver', () => {
      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Video1',
          liveTime: 1700000000000,
          playGame: ['Game1'],
          liver: 'LiverA',
        },
        {
          aid: 1002,
          bvId: 'BV1002',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Video2',
          liveTime: 1700000000000,
          playGame: ['Game2'],
          liver: 'LiverB',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      // 验证为每个主播输出日志
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('正在生成 LiverA 的直播回放列表')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('正在生成 LiverB 的直播回放列表')
      );
    });
  });

  describe('multiple games per video', () => {
    beforeEach(() => {
      mockFs({
        data: {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({}),
          },
          'SpellingCorrections.json': JSON.stringify({
            version: '2.0',
            global: { rules: [] },
            uidRules: {},
          }),
        },
        docx: {},
      });
    });

    it('should handle single video with multiple games', () => {
      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 7200,
          title: 'Multi-game Stream',
          liveTime: 1700000000000,
          playGame: ['GameA', 'GameB', 'GameC'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // 验证每个游戏都被列出
      expect(content).toContain('## GameA');
      expect(content).toContain('## GameB');
      expect(content).toContain('## GameC');

      // 验证同一视频出现在多个游戏中
      expect(content).toContain('Multi-game Stream');
    });

    it('should group videos by game correctly', () => {
      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Video 1 with GameA',
          liveTime: 1700000000000,
          playGame: ['GameA'],
          liver: 'TestLiver',
        },
        {
          aid: 1002,
          bvId: 'BV1002',
          publishTime: 1700001000,
          liveDuration: 3600,
          title: 'Video 2 with GameA and GameB',
          liveTime: 1700001000000,
          playGame: ['GameA', 'GameB'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // GameA 应该有两条记录
      const gameAIndex = content.indexOf('## GameA');
      const gameBIndex = content.indexOf('## GameB');
      const gameASection = content.substring(gameAIndex, gameBIndex > 0 ? gameBIndex : undefined);

      expect(gameASection.match(/Video 1 with GameA/g)?.length).toBe(1);
      expect(gameASection.match(/Video 2 with GameA and GameB/g)?.length).toBe(1);

      // GameB 应该有一条记录
      const gameBSection = content.substring(gameBIndex);
      expect(gameBSection.match(/Video 2 with GameA and GameB/g)?.length).toBe(1);
    });
  });

  describe('AidMapperStore game list correction', () => {
    it('should use corrected game list from AidMapperStore when available', () => {
      mockFs({
        data: {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({
              '1001': ['CorrectedGame1', 'CorrectedGame2'],
            }),
          },
          'SpellingCorrections.json': JSON.stringify({
            version: '2.0',
            global: { rules: [] },
            uidRules: {},
          }),
        },
        docx: {},
      });

      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Test Video',
          liveTime: 1700000000000,
          playGame: ['OriginalGame1', 'OriginalGame2'], // 应该被纠正
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // 验证使用了纠正后的游戏名
      expect(content).toContain('## CorrectedGame1');
      expect(content).toContain('## CorrectedGame2');
      expect(content).not.toContain('## OriginalGame1');
      expect(content).not.toContain('## OriginalGame2');
    });

    it('should use original game list when AidMapperStore has empty list', () => {
      mockFs({
        data: {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({
              '1001': [], // 空列表
            }),
          },
          'SpellingCorrections.json': JSON.stringify({
            version: '2.0',
            global: { rules: [] },
            uidRules: {},
          }),
        },
        docx: {},
      });

      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Test Video',
          liveTime: 1700000000000,
          playGame: ['OriginalGame'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // 空列表应该使用原始游戏名
      expect(content).toContain('## OriginalGame');
    });

    it('should use original game list when AidMapperStore has no entry for aid', () => {
      mockFs({
        data: {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({
              '9999': ['OtherGame'], // 不同的 aid
            }),
          },
          'SpellingCorrections.json': JSON.stringify({
            version: '2.0',
            global: { rules: [] },
            uidRules: {},
          }),
        },
        docx: {},
      });

      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Test Video',
          liveTime: 1700000000000,
          playGame: ['OriginalGame'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // 没有对应 aid 的条目，使用原始游戏名
      expect(content).toContain('## OriginalGame');
    });
  });

  describe('SpellingCorrection functionality', () => {
    it('should apply global spelling corrections', () => {
      mockFs({
        data: {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({}),
          },
          'SpellingCorrections.json': JSON.stringify({
            version: '2.0',
            global: {
              rules: [
                { from: 'dota', to: 'Dota 2' },
                { from: 'cs', to: 'Counter-Strike' },
              ],
            },
            uidRules: {},
          }),
        },
        docx: {},
      });

      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Gaming Stream',
          liveTime: 1700000000000,
          playGame: ['dota', 'cs'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // 验证拼写纠正被应用
      expect(content).toContain('## Dota 2');
      expect(content).toContain('## Counter-Strike');
      expect(content).not.toContain('## dota');
      expect(content).not.toContain('## cs');
    });

    it('should apply UID-specific spelling corrections', () => {
      mockFs({
        data: {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({}),
          },
          'SpellingCorrections.json': JSON.stringify({
            version: '2.0',
            global: { rules: [] },
            uidRules: {
              [testUid.toString()]: {
                rules: [
                  { from: 'apex', to: 'Apex Legends' },
                ],
              },
            },
          }),
        },
        docx: {},
      });

      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Battle Royale',
          liveTime: 1700000000000,
          playGame: ['apex'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // 验证 UID 专属规则被应用
      expect(content).toContain('## Apex Legends');
      expect(content).not.toContain('## apex');
    });

    it('should apply UID rules before global rules', () => {
      mockFs({
        data: {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({}),
          },
          'SpellingCorrections.json': JSON.stringify({
            version: '2.0',
            global: {
              rules: [
                { from: 'game', to: 'Global Game' },
              ],
            },
            uidRules: {
              [testUid.toString()]: {
                rules: [
                  { from: 'game', to: 'UID Specific Game' },
                ],
              },
            },
          }),
        },
        docx: {},
      });

      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Test',
          liveTime: 1700000000000,
          playGame: ['game'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // UID 规则应该优先于全局规则
      expect(content).toContain('## UID Specific Game');
      expect(content).not.toContain('## Global Game');
    });
  });

  describe('markdown content generation', () => {
    beforeEach(() => {
      mockFs({
        data: {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({}),
          },
          'SpellingCorrections.json': JSON.stringify({
            version: '2.0',
            global: { rules: [] },
            uidRules: {},
          }),
        },
        docx: {},
      });
    });

    it('should include correct video links with aid', () => {
      const records: RecordItem[] = [
        {
          aid: 123456,
          bvId: 'BV123456',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Test Video',
          liveTime: 1700000000000,
          playGame: ['TestGame'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // 验证 B站视频链接格式
      expect(content).toContain('https://www.bilibili.com/video/av123456/');
    });

    it('should format duration correctly', () => {
      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3661, // 1小时1分1秒
          title: 'Long Stream',
          liveTime: 1700000000000,
          playGame: ['TestGame'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // 验证时长格式化 (01:01:01)
      expect(content).toContain('01:01:01');
    });

    it('should format date correctly', () => {
      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Test Video',
          liveTime: new Date('2024-01-15').getTime(),
          playGame: ['TestGame'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // 验证日期格式化
      expect(content).toContain('2024-01-15');
    });

    it('should number episodes correctly within each game', () => {
      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'First Episode',
          liveTime: 1700000000000,
          playGame: ['SameGame'],
          liver: 'TestLiver',
        },
        {
          aid: 1002,
          bvId: 'BV1002',
          publishTime: 1700001000,
          liveDuration: 3600,
          title: 'Second Episode',
          liveTime: 1700001000000,
          playGame: ['SameGame'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      const content = readFileSync(expectedFilePath, 'utf-8');

      // 验证集数编号 (按时间降序后，最新的应该是 Part 1)
      // 注意：reverse() 后，最新的排在最后，所以 oldest 是 Part 1
      expect(content).toContain('Part 1');
      expect(content).toContain('Part 2');
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      mockFs({
        data: {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({}),
          },
          'SpellingCorrections.json': JSON.stringify({
            version: '2.0',
            global: { rules: [] },
            uidRules: {},
          }),
        },
        docx: {},
      });
    });

    it('should handle empty record list', () => {
      const store = createMockRecordStore([]) as RecordStore;

      // 不应该抛出错误
      expect(() => {
        generateMarkdownRecord(testUid, testUserName, store);
      }).not.toThrow();

      // 不应该生成任何主播目录或文件
      const docxPath = resolve(cwd(), 'docx');
      // docx 目录可能不存在或者为空（没有主播子目录）
      if (existsSync(docxPath)) {
        // 如果存在，检查是否有任何子目录
        const fs = require('fs');
        const entries = fs.readdirSync(docxPath, { withFileTypes: true });
        const subdirs = entries.filter((entry: any) => entry.isDirectory());
        expect(subdirs.length).toBe(0);
      }

      // 不应该输出任何生成日志
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it('should handle special characters in liver name', () => {
      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Test Video',
          liveTime: 1700000000000,
          playGame: ['Game1'],
          liver: 'Special/Liver\\Name',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;
      generateMarkdownRecord(testUid, testUserName, store);

      // 验证文件被创建（特殊字符应该被安全处理）
      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'Special_Liver_Name',
        `Special_Liver_Name直播回放列表(from ${testUserName}).md`
      );
      expect(existsSync(expectedFilePath)).toBe(true);
    });

    it('should handle missing SpellingCorrections.json gracefully', () => {
      mockFs.restore();
      mockFs({
        data: {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({}),
          },
          // 没有 SpellingCorrections.json - 这会导致 console.warn 被调用
        },
        docx: {},
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const records: RecordItem[] = [
        {
          aid: 1001,
          bvId: 'BV1001',
          publishTime: 1700000000,
          liveDuration: 3600,
          title: 'Test Video',
          liveTime: 1700000000000,
          playGame: ['TestGame'],
          liver: 'TestLiver',
        },
      ];

      const store = createMockRecordStore(records) as RecordStore;

      // 不应该抛出错误，即使配置文件缺失
      expect(() => {
        generateMarkdownRecord(testUid, testUserName, store);
      }).not.toThrow();

      // 仍然应该生成文件
      const expectedFilePath = resolve(
        cwd(),
        'docx',
        'TestLiver',
        `TestLiver直播回放列表(from ${testUserName}).md`
      );
      expect(existsSync(expectedFilePath)).toBe(true);

      consoleWarnSpy.mockRestore();
    });
  });
});
