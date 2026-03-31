import { formatDate } from '../../../module/generateReadme/formatDate';

describe('formatDate', () => {
  describe('valid timestamps', () => {
    it('should format timestamp to yyyy-mm-dd format', () => {
      const timestamp = Date.UTC(2024, 0, 1);
      expect(formatDate(timestamp)).toBe('2024-01-01');
    });

    it('should handle Beijing timezone conversion (UTC+8)', () => {
      const timestamp = Date.UTC(2024, 0, 1, 20, 0, 0);
      expect(formatDate(timestamp)).toBe('2024-01-02');
    });

    it('should format leap year date correctly', () => {
      const timestamp = Date.UTC(2024, 1, 29);
      expect(formatDate(timestamp)).toBe('2024-02-29');
    });

    it('should handle year boundaries', () => {
      const timestamp = Date.UTC(2023, 11, 31);
      expect(formatDate(timestamp)).toBe('2023-12-31');
    });
  });

  describe('invalid inputs', () => {
    it('should return placeholder for NaN', () => {
      expect(formatDate(NaN)).toBe('----/--/--');
    });

    it('should return placeholder for Infinity', () => {
      expect(formatDate(Infinity)).toBe('----/--/--');
    });

    it('should return placeholder for -Infinity', () => {
      expect(formatDate(-Infinity)).toBe('----/--/--');
    });

    it('should return placeholder for out-of-range timestamps', () => {
      expect(formatDate(8640000000000000)).toBe('----/--/--');
    });
  });

  describe('edge cases', () => {
    it('should handle negative timestamps (before 1970)', () => {
      expect(formatDate(-1)).toBe('1970-01-01');
    });

    it('should handle zero timestamp', () => {
      expect(formatDate(0)).toBe('1970-01-01');
    });
  });
});
