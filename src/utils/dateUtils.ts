/**
 * 判断给定时间戳是否属于今天（北京时间）
 * @param timestamp 毫秒时间戳
 * @returns boolean
 */
export function isToday(timestamp: number): boolean {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return false;
  }

  // 获取当前时间的北京时间
  const now = new Date();
  const beijingOffset = 8 * 60 * 60 * 1000; // UTC+8
  const beijingNow = new Date(now.getTime() + beijingOffset);

  // 获取目标时间的北京时间
  const beijingTarget = new Date(timestamp + beijingOffset);

  // 比较年月日
  return (
    beijingNow.getUTCFullYear() === beijingTarget.getUTCFullYear() &&
    beijingNow.getUTCMonth() === beijingTarget.getUTCMonth() &&
    beijingNow.getUTCDate() === beijingTarget.getUTCDate()
  );
}
