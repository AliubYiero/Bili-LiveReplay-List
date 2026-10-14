import {
  normalizeReplayResponse,
  normalizeUploadResponse,
  SeriesArchivesItem,
  SeriesArchivesResponse,
  SpaceArcSearchItem,
  SpaceArcSearchResponse,
} from '../../../scraper/normalize.ts';

const createUploadResponse = (
  vlist: SpaceArcSearchItem[],
  page: { count: number; pn: number; ps: number },
): SpaceArcSearchResponse => ({
  code: 0,
  message: '0',
  data: { list: { vlist }, page },
});

const createReplayResponse = (
  archives: SeriesArchivesItem[],
  page: { num: number; size: number; total: number },
): SeriesArchivesResponse => ({
  code: 0,
  message: '0',
  data: { archives, page },
});

describe('normalizeUploadResponse', () => {
  it('把主页视频响应归一化成统一结构', () => {
    const response = createUploadResponse(
      [
        {
          aid: 1001,
          bvid: 'BV1001',
          title: '【Mr.Quin】某游戏',
          created: 1700000000,
          length: '01:30:00',
        },
      ],
      { count: 1, pn: 1, ps: 30 },
    );

    const page = normalizeUploadResponse(response);

    expect(page).toEqual({
      sourceType: 'upload',
      currentPage: 1,
      pageSize: 30,
      total: 1,
      archives: [
        {
          aid: 1001,
          bvId: 'BV1001',
          title: '【Mr.Quin】某游戏',
          publishTime: 1700000000000,
          liveDuration: 5400,
          sourceType: 'upload',
        },
      ],
    });
  });

  it('页码取自 pn、每页条数取自 ps、总条数取自 count', () => {
    // 实测响应形如 {"pn":2,"ps":40,"count":1105}
    const response = createUploadResponse(
      [ { aid: 1, bvid: 'BV1', title: 't', created: 1, length: '00:01' } ],
      { count: 120, pn: 2, ps: 40 },
    );

    const page = normalizeUploadResponse(response);

    expect(page.currentPage).toBe(2);
    expect(page.pageSize).toBe(40);
    expect(page.total).toBe(120);
  });

  it('页码字段兼容 num（旧字段名），避免翻页不推进', () => {
    const response: SpaceArcSearchResponse = {
      code: 0,
      data: {
        list: { vlist: [ { aid: 1, bvid: 'BV1', title: 't', created: 1, length: '00:01' } ] },
        page: { count: 120, num: 3, size: 20 },
      },
    };

    const page = normalizeUploadResponse(response);

    expect(page.currentPage).toBe(3);
    expect(page.pageSize).toBe(20);
  });

  it('缺少 list / page 时返回空页且不抛错', () => {
    expect(normalizeUploadResponse({ code: 0 })).toEqual({
      sourceType: 'upload',
      currentPage: 1,
      pageSize: 0,
      total: 0,
      archives: [],
    });
  });

  it('length 非法时按 0 处理，其余字段照常', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const response = createUploadResponse(
      [ { aid: 1, bvid: 'BV1', title: 't', created: 1, length: '未知' } ],
      { count: 1, pn: 1, ps: 30 },
    );

    expect(normalizeUploadResponse(response).archives[0].liveDuration).toBe(0);
    warnSpy.mockRestore();
  });
});

describe('normalizeReplayResponse', () => {
  it('把直播回放响应归一化成统一结构', () => {
    const response = createReplayResponse(
      [
        {
          aid: 2001,
          bvid: 'BV2001',
          title: '【直播回放】某游戏 2021年5月9日1点场',
          pubdate: 1620576000,
          duration: 7200,
        },
      ],
      { num: 1, size: 30, total: 1 },
    );

    const page = normalizeReplayResponse(response);

    expect(page).toEqual({
      sourceType: 'replay',
      currentPage: 1,
      pageSize: 30,
      total: 1,
      archives: [
        {
          aid: 2001,
          bvId: 'BV2001',
          title: '【直播回放】某游戏 2021年5月9日1点场',
          publishTime: 1620576000000,
          liveDuration: 7200,
          sourceType: 'replay',
        },
      ],
    });
  });

  it('缺少 archives / page 时返回空页且不抛错', () => {
    expect(normalizeReplayResponse({ code: 0 })).toEqual({
      sourceType: 'replay',
      currentPage: 1,
      pageSize: 0,
      total: 0,
      archives: [],
    });
  });

  it('duration 用秒而不再做换算', () => {
    const response = createReplayResponse(
      [ { aid: 1, bvid: 'BV1', title: 't', pubdate: 1, duration: 59 } ],
      { num: 1, size: 30, total: 1 },
    );

    expect(normalizeReplayResponse(response).archives[0].liveDuration).toBe(59);
  });
});
