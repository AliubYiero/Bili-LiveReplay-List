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
    const beijingOffset = 8 * 60 * 60 * 1000; // 8 hours in ms
    const now = new Date();
    const beijingDate = new Date(now.getTime() + beijingOffset);
    
    // 创建今天凌晨北京时间的时间戳
    const todayBeijing = new Date(
      beijingDate.getFullYear(),
      beijingDate.getMonth(),
      beijingDate.getDate()
    ).getTime() - beijingOffset;
    
    expect(isToday(todayBeijing + 1000)).toBe(true);
  });
});