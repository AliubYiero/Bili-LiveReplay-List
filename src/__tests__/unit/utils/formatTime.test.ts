import { formatTime } from '../../../module/generateReadme/formatTime';

describe('formatTime', () => {
  describe('valid inputs', () => {
    it('should format 0 seconds correctly', () => {
      expect(formatTime(0)).toBe('00:00:00');
    });

    it('should format seconds less than 60', () => {
      expect(formatTime(45)).toBe('00:00:45');
    });

    it('should format minutes correctly', () => {
      expect(formatTime(61)).toBe('00:01:01');
    });

    it('should format hours correctly', () => {
      expect(formatTime(3661)).toBe('01:01:01');
    });

    it('should handle more than 24 hours', () => {
      expect(formatTime(90061)).toBe('25:01:01');
    });

    it('should pad single digits with zeros', () => {
      expect(formatTime(5)).toBe('00:00:05');
    });

    it('should handle exactly 3600 seconds (1 hour)', () => {
      expect(formatTime(3600)).toBe('01:00:00');
    });
  });

  describe('decimal truncation', () => {
    it('should truncate decimal seconds', () => {
      expect(formatTime(61.9)).toBe('00:01:01');
    });

    it('should truncate decimal part entirely', () => {
      expect(formatTime(0.9)).toBe('00:00:00');
    });
  });

  describe('error handling', () => {
    it('should throw RangeError for negative input', () => {
      expect(() => formatTime(-1)).toThrow(RangeError);
      expect(() => formatTime(-1)).toThrow('Input seconds must be non-negative.');
    });

    it('should throw RangeError for large negative numbers', () => {
      expect(() => formatTime(-1000)).toThrow(RangeError);
    });
  });
});
