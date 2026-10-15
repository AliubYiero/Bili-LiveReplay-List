import mockFs from 'mock-fs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import {
  buildDataFileLocation,
  generateWeb,
  summarizeLiveTimes,
} from '../../../../module/generateWeb/generateWeb.ts';

const CACHE_TIMESTAMP = 1700000000000;

/** Mr.Quin 本人上传: 两条记录, 一条靠拼写纠正, 一条靠 aidMapper 人工映射覆盖 */
const quinRecordFile = {
  cache: { uid: 15810, userName: 'Mr.Quin', aid: 1002, timestamp: CACHE_TIMESTAMP },
  records: [
    {
      aid: 1001,
      bvId: 'BV1001',
      publishTime: 1600000001000,
      liveDuration: 3600,
      title: '塞尔达 1',
      liveTime: 1600000000000,
      playGame: ['dota2'],
      liver: 'Mr.Quin',
    },
    {
      aid: 1002,
      bvId: 'BV1002',
      publishTime: 1700000001000,
      liveDuration: 1800,
      title: '塞尔达 2',
      liveTime: 1700000000000,
      playGame: ['塞尔达'],
      liver: 'Mr.Quin',
    },
  ],
};

/** 第三方上传者: 同一份文件里含两个主播 */
const longHeiRecordFile = {
  cache: { uid: 245335, userName: '胧黑', aid: 2002, timestamp: CACHE_TIMESTAMP },
  records: [
    {
      aid: 2001,
      bvId: 'BV2001',
      publishTime: 1650000001000,
      liveDuration: 7200,
      title: 'Mr.Quin 的录播',
      liveTime: 1650000000000,
      playGame: ['塞尔达'],
      liver: 'Mr.Quin',
    },
    {
      aid: 2002,
      bvId: 'BV2002',
      publishTime: 1660000001000,
      liveDuration: 5400,
      title: '机皇的录播',
      liveTime: 1660000000000,
      playGame: ['艾尔登法环'],
      liver: '机皇',
    },
  ],
};

const setupMockFs = () => {
  mockFs({
    'data': {
      'SpellingCorrections.json': JSON.stringify({
        version: '2.0',
        global: { rules: [{ from: 'dota2', to: 'DOTA2' }] },
        uidRules: {},
      }),
      '15810': {
        'Mr.Quin.record.json': JSON.stringify(quinRecordFile),
        'Mr.Quin.aid.json': JSON.stringify({ '1002': ['旷野之息'] }),
      },
      '245335': {
        '胧黑.record.json': JSON.stringify(longHeiRecordFile),
        '胧黑.aid.json': JSON.stringify({}),
      },
    },
    'docs': {
      'icon.svg': '<svg/>',
      // 上一轮生成留下的孤儿文件, 生成时应被清掉
      'data': { 'Stale': { 'old.json': '{}' } },
    },
  });
};

const readIndexHtml = () => readFileSync(resolveDocs('index.html'), 'utf8');

const resolveDocs = (...segments: string[]) => join(cwd(), 'docs', ...segments);

const readDataFile = (liver: string, userName: string) =>
  JSON.parse(readFileSync(resolveDocs('data', liver, `${userName}.json`), 'utf8'));

/** index.html 里的 `const manifest = {...};` 反解出来 */
const readInlinedManifest = () => {
  const html = readIndexHtml();
  const marker = 'const manifest = ';
  const start = html.indexOf(marker) + marker.length;
  const end = html.indexOf('\n', start);
  return JSON.parse(html.slice(start, end).trim().replace(/;$/, ''));
};

describe('generateWeb', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    setupMockFs();
  });

  afterEach(() => {
    mockFs.restore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('index.html', () => {
    it('只内联 manifest, 不携带任何录播记录', async () => {
      await generateWeb();

      const html = readIndexHtml();

      expect(html).toContain('const manifest =');
      // 数据里的记录级字段与标题都不该出现在外壳里（`_globalPartMap` 只作为前端属性名出现）
      expect(html).not.toContain('"_globalPartMap"');
      expect(html).not.toContain('"bvId"');
      expect(html).not.toContain('"publishTime"');
      expect(html).not.toContain('塞尔达 1');
    });

    it('manifest 按主播分组, 上传者摘要不含 records', async () => {
      await generateWeb();

      const manifest = readInlinedManifest();

      expect(manifest.streamers.map((s: { liver: string }) => s.liver).sort())
        .toEqual(['Mr.Quin', '机皇']);

      const quin = manifest.streamers.find((s: { liver: string }) => s.liver === 'Mr.Quin');
      // newestTime 降序: Mr.Quin(1.7e12) 排在 胧黑(1.65e12) 前面
      expect(quin.uploaders.map((u: { userName: string }) => u.userName))
        .toEqual(['Mr.Quin', '胧黑']);

      expect(quin.uploaders[0]).toMatchObject({
        totalVideos: 2,
        oldestTime: 1600000000000,
        newestTime: 1700000000000,
        latestUpdate: CACHE_TIMESTAMP,
        isSelf: true,
        dataFile: 'data/Mr.Quin/Mr.Quin.json',
      });
      expect(quin.uploaders[0]).not.toHaveProperty('records');

      expect(quin.uploaders[1]).toMatchObject({
        totalVideos: 1,
        oldestTime: 1650000000000,
        newestTime: 1650000000000,
        isSelf: false,
        dataFile: `data/Mr.Quin/${encodeURIComponent('胧黑')}.json`,
      });
    });
  });

  describe('数据文件', () => {
    it('按 (主播, 上传者) 拆分, 同一文件里的多个主播各写一份', async () => {
      await generateWeb();

      expect(existsSync(resolveDocs('data', 'Mr.Quin', 'Mr.Quin.json'))).toBe(true);
      expect(existsSync(resolveDocs('data', 'Mr.Quin', '胧黑.json'))).toBe(true);
      expect(existsSync(resolveDocs('data', '机皇', '胧黑.json'))).toBe(true);
    });

    it('只保留前端用得到的字段, 按 liveTime 升序, 并应用映射与拼写纠正', async () => {
      await generateWeb();

      expect(readDataFile('Mr.Quin', 'Mr.Quin')).toEqual({
        liver: 'Mr.Quin',
        userName: 'Mr.Quin',
        latestUpdate: CACHE_TIMESTAMP,
        records: [
          {
            aid: 1001,
            title: '塞尔达 1',
            liveTime: 1600000000000,
            liveDuration: 3600,
            // aid.json 里没有 1001, 回退到标题解析结果后再走全局拼写纠正
            playGame: ['DOTA2'],
          },
          {
            aid: 1002,
            title: '塞尔达 2',
            liveTime: 1700000000000,
            liveDuration: 1800,
            // aid.json 人工映射优先于标题解析
            playGame: ['旷野之息'],
          },
        ],
      });
    });

    it('生成前清空 data/ 目录, 但不影响 docs 下的其他文件', async () => {
      await generateWeb();

      expect(existsSync(resolveDocs('data', 'Stale'))).toBe(false);
      expect(existsSync(resolveDocs('icon.svg'))).toBe(true);
    });
  });
});

describe('summarizeLiveTimes', () => {
  it('取最早与最晚的直播时间', () => {
    expect(summarizeLiveTimes([{ liveTime: 300 }, { liveTime: 100 }, { liveTime: 200 }]))
      .toEqual({ oldestTime: 100, newestTime: 300 });
  });

  it('忽略无效的 0 值', () => {
    expect(summarizeLiveTimes([{ liveTime: 0 }, { liveTime: 500 }]))
      .toEqual({ oldestTime: 500, newestTime: 500 });
  });

  it('没有任何有效时间时返回 0', () => {
    expect(summarizeLiveTimes([{ liveTime: 0 }])).toEqual({ oldestTime: 0, newestTime: 0 });
    expect(summarizeLiveTimes([])).toEqual({ oldestTime: 0, newestTime: 0 });
  });
});

describe('buildDataFileLocation', () => {
  it('中文名落盘为原文, URL 用 encodeURIComponent', () => {
    expect(buildDataFileLocation('傲慢的小肉包', 'Cyan_Rose_Sea')).toEqual({
      relativePath: join('data', '傲慢的小肉包', 'Cyan_Rose_Sea.json'),
      url: `data/${encodeURIComponent('傲慢的小肉包')}/Cyan_Rose_Sea.json`,
    });
  });

  it('非法文件名字符会被替换, 且落盘名与 URL 一一对应', () => {
    const location = buildDataFileLocation('a/b', 'c:d');

    expect(location.relativePath).toBe(join('data', 'a_b', 'c_d.json'));
    expect(location.url).toBe(`data/${encodeURIComponent('a_b')}/${encodeURIComponent('c_d.json')}`);
  });
});
