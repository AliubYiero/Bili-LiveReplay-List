import { calcMaxPage, shouldStopPaging } from '../../../scraper/paging.ts';
import { NormalizedPage } from '../../../scraper/normalize.ts';
import { UnparseRecordItem, VideoSourceType } from '../../../interface/IRecord.ts';

const createArchive = (aid: number): UnparseRecordItem => ({
  aid,
  bvId: `BV${aid}`,
  title: `Video ${aid}`,
  publishTime: 1700000000000,
  liveDuration: 3600,
});

const createPage = (
  currentPage: number,
  count: number,
  options: { pageSize?: number; total?: number; sourceType?: VideoSourceType } = {},
): NormalizedPage => ({
  sourceType: options.sourceType ?? 'upload',
  currentPage,
  pageSize: options.pageSize ?? 30,
  total: options.total ?? 300,
  archives: Array.from({ length: count }, (_, index) => createArchive(index + 1)),
});

describe('calcMaxPage', () => {
  it('向上取整', () => {
    expect(calcMaxPage(300, 30)).toBe(10);
    expect(calcMaxPage(301, 30)).toBe(11);
    expect(calcMaxPage(1, 30)).toBe(1);
  });

  it('总数为 0 时至少返回 1 页', () => {
    expect(calcMaxPage(0, 30)).toBe(1);
  });

  it('pageSize 非法时返回 1', () => {
    expect(calcMaxPage(300, 0)).toBe(1);
    expect(calcMaxPage(300, Number.NaN)).toBe(1);
  });
});

describe('shouldStopPaging', () => {
  const limitPages = 100;

  it('当前页没有数据时停止', () => {
    expect(shouldStopPaging(createPage(1, 0, { total: 300 }), limitPages)).toBe(true);
  });

  it('翻到最后页的下一页时停止', () => {
    // 共 10 页：第 9 页还能继续，第 10 页之后停止
    expect(shouldStopPaging(createPage(9, 30, { total: 300, pageSize: 30 }), limitPages)).toBe(false);
    expect(shouldStopPaging(createPage(10, 30, { total: 300, pageSize: 30 }), limitPages)).toBe(true);
  });

  it('只有一页时第一页就停止', () => {
    expect(shouldStopPaging(createPage(1, 5, { total: 5, pageSize: 30 }), limitPages)).toBe(true);
  });

  it('达到页数上限时停止', () => {
    expect(shouldStopPaging(createPage(100, 30, { total: 100000, pageSize: 30 }), limitPages)).toBe(true);
    expect(shouldStopPaging(createPage(99, 30, { total: 100000, pageSize: 30 }), limitPages)).toBe(false);
  });

  it('两种数据源使用同一套判断', () => {
    const uploadPage = createPage(1, 5, { total: 5, sourceType: 'upload' });
    const replayPage = createPage(1, 5, { total: 5, sourceType: 'replay' });

    expect(shouldStopPaging(uploadPage, limitPages)).toBe(true);
    expect(shouldStopPaging(replayPage, limitPages)).toBe(true);
  });
});
