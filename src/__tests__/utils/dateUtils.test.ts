import { isToday } from '../../utils/dateUtils.ts';

describe('isToday', () => {
  it('should return true for today\'s timestamp', () => {
    const now = Date.now();
    expect(isToday(now)).toBe(true);
  });

  it('should return false for yesterday\'s timestamp', () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    expect(isToday(yesterday)).toBe(false);
  });

  it('should return false for tomorrow\'s timestamp', () => {
    const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
    expect(isToday(tomorrow)).toBe(false);
  });

  it('should return false for invalid timestamp', () => {
    expect(isToday(NaN)).toBe(false);
    expect(isToday(-1)).toBe(false);
  });

  it('should handle Beijing timezone correctly', () => {
    // 测试北京时间跨天边界情况
    // 例如：UTC 时间已经是第二天，但北京时间还是今天
    //
    // 注意：不能用 `new Date(y, m, d)` 取「北京时间今天」——它按运行机器的本地时区构造，
    // 在本来就是 UTC+8 的机器上会再叠加一次偏移，只在本地 08:00 之前失败（UTC 环境下又恒过）。
    // 这里全程用 UTC 运算，结果与运行环境的时区无关。
    const beijingOffset = 8 * 60 * 60 * 1000; // 8 hours in ms

    // 当前时刻的「北京时间」，取它的 UTC 年月日即北京日期
    const beijingNow = new Date(Date.now() + beijingOffset);
    // 北京时间今天 00:00 对应的绝对时间戳
    const beijingTodayStart =
      Date.UTC(
        beijingNow.getUTCFullYear(),
        beijingNow.getUTCMonth(),
        beijingNow.getUTCDate(),
      ) - beijingOffset;

    // 边界之内
    expect(isToday(beijingTodayStart)).toBe(true);
    expect(isToday(beijingTodayStart + 1000)).toBe(true);
    expect(isToday(Date.now())).toBe(true);
    // 边界之外：北京时间昨天的最后一毫秒
    expect(isToday(beijingTodayStart - 1)).toBe(false);
    // 边界之外：北京时间明天的第一毫秒
    expect(isToday(beijingTodayStart + 24 * 60 * 60 * 1000)).toBe(false);
  });
});