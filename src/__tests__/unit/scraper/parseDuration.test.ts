import { parseDuration } from '../../../scraper/parseDuration.ts';

describe('parseDuration', () => {
  describe('数字输入（直播回放接口）', () => {
    it('原样返回秒数', () => {
      expect(parseDuration(3600)).toBe(3600);
      expect(parseDuration(0)).toBe(0);
    });

    it('向下取整', () => {
      expect(parseDuration(3599.9)).toBe(3599);
    });

    it('负数与非法数值按 0 处理', () => {
      expect(parseDuration(-1)).toBe(0);
      expect(parseDuration(Number.NaN)).toBe(0);
      expect(parseDuration(Number.POSITIVE_INFINITY)).toBe(0);
    });
  });

  describe('字符串输入（主页视频接口）', () => {
    it('解析 HH:MM:SS', () => {
      expect(parseDuration('01:23:45')).toBe(1 * 3600 + 23 * 60 + 45);
      expect(parseDuration('00:00:30')).toBe(30);
      expect(parseDuration('12:00:00')).toBe(12 * 3600);
    });

    it('解析 MM:SS', () => {
      expect(parseDuration('05:30')).toBe(5 * 60 + 30);
      expect(parseDuration('0:07')).toBe(7);
    });

    it('忽略首尾空白', () => {
      expect(parseDuration('  01:00  ')).toBe(60);
    });

    it('超过 24 小时的时长也能解析', () => {
      expect(parseDuration('26:00:00')).toBe(26 * 3600);
    });
  });

  describe('非法输入', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('无法解析时告警并返回 0', () => {
      expect(parseDuration('')).toBe(0);
      expect(parseDuration('abc')).toBe(0);
      expect(parseDuration('1:2:3:4')).toBe(0);
      expect(parseDuration('1:aa:2')).toBe(0);
      expect(warnSpy).toHaveBeenCalledTimes(4);
    });

    it('非数字的 undefined 也不会抛错', () => {
      expect(parseDuration(undefined as unknown as string)).toBe(0);
    });
  });
});
