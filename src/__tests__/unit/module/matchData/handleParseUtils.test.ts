import {
  extractLiveDate,
  extractLiver,
  cleanGameName,
} from '../../../../module/matchData/handleParseUtils';

describe('handleParseUtils', () => {
  describe('extractLiveDate', () => {
    describe('Chinese date format', () => {
      it('should extract date from 2024年1月15日 format', () => {
        const result = extractLiveDate('直播 2024年1月15日', 0);
        expect(result).toBe(new Date(2024, 0, 15).getTime());
      });

      it('should extract date from 2-digit year 24年1月15日 format', () => {
        const result = extractLiveDate('直播 24年1月15日', 0);
        expect(result).toBe(new Date(2024, 0, 15).getTime());
      });

      it('should handle double-digit month and day', () => {
        const result = extractLiveDate('直播 2024年12月25日', 0);
        expect(result).toBe(new Date(2024, 11, 25).getTime());
      });
    });

    describe('ISO date format', () => {
      it('should extract date from 2024-1-15 format', () => {
        const result = extractLiveDate('直播 2024-1-15', 0);
        expect(result).toBe(new Date(2024, 0, 15).getTime());
      });

      it('should extract date from 2-digit year 24-1-15 format', () => {
        const result = extractLiveDate('直播 24-1-15', 0);
        expect(result).toBe(new Date(2024, 0, 15).getTime());
      });

      it('should extract date from YYYY-MM-DD format', () => {
        const result = extractLiveDate('直播 2024-12-25', 0);
        expect(result).toBe(new Date(2024, 11, 25).getTime());
      });
    });

    describe('fallback behavior', () => {
      it('should use fallback date when no date pattern found', () => {
        const fallbackTimestamp = 1700000000000;
        const result = extractLiveDate('No date here', fallbackTimestamp);
        expect(result).toBe(new Date(fallbackTimestamp).getTime());
      });

      it('should prefer Chinese format over ISO format', () => {
        const result = extractLiveDate('2024年1月1日 vs 2023-12-31', 0);
        expect(result).toBe(new Date(2024, 0, 1).getTime());
      });
    });
  });

  describe('extractLiver', () => {
    it('should extract 机皇 from 【机皇录播】', () => {
      expect(extractLiver('【机皇录播】游戏名 2024-1-1')).toBe('机皇');
    });

    it('should extract 机皇 from 【Quin？机皇！】', () => {
      expect(extractLiver('【Quin？机皇！】游戏名 2024-1-1')).toBe('机皇');
    });

    it('should extract 机智的肯尼 from 【肯尼录播】', () => {
      expect(extractLiver('【肯尼录播】游戏名 2024-1-1')).toBe('机智的肯尼');
    });

    it('should extract 北极熊剩饭 from 【剩饭录播】', () => {
      expect(extractLiver('【剩饭录播】游戏名 2024-1-1')).toBe('北极熊剩饭');
    });

    it('should extract Mr.Quin from 【quin录播】', () => {
      expect(extractLiver('【quin录播】游戏名 2024-1-1')).toBe('Mr.Quin');
    });

    it('should extract Mr.Quin from 【Mr.Quin】', () => {
      expect(extractLiver('【Mr.Quin】游戏名 2024-1-1')).toBe('Mr.Quin');
    });

    it('should be case-insensitive for 【quin录播】', () => {
      expect(extractLiver('【QUIN录播】游戏名 2024-1-1')).toBe('Mr.Quin');
    });

    it('should return null for unknown prefix', () => {
      expect(extractLiver('【未知主播】游戏名 2024-1-1')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(extractLiver('')).toBeNull();
    });
  });

  describe('cleanGameName', () => {
    it('should remove Chinese parentheses content', () => {
      expect(cleanGameName('游戏名（备注）')).toBe('游戏名');
    });

    it('should remove English parentheses content', () => {
      expect(cleanGameName('GameName (Note)')).toBe('GameName');
    });

    it('should remove Chinese brackets content', () => {
      expect(cleanGameName('游戏名【备注】')).toBe('游戏名');
    });

    it('should remove —残缺 suffix', () => {
      expect(cleanGameName('游戏名—残缺')).toBe('游戏名');
    });

    it('should remove -已爆炸 suffix', () => {
      expect(cleanGameName('游戏名-已爆炸')).toBe('游戏名');
    });

    it('should remove 残缺— prefix', () => {
      expect(cleanGameName('残缺—游戏名')).toBe('游戏名');
    });

    it('should remove 初体验 suffix', () => {
      expect(cleanGameName('游戏名初体验')).toBe('游戏名');
    });

    it('should remove 直播录像 suffix', () => {
      expect(cleanGameName('游戏名直播录像')).toBe('游戏名');
    });

    it('should handle multiple patterns', () => {
      expect(cleanGameName('游戏名（备注）—残缺')).toBe('游戏名');
    });

    it('should trim whitespace', () => {
      expect(cleanGameName('  游戏名  ')).toBe('游戏名');
    });

    it('should return empty string when all content is removed', () => {
      expect(cleanGameName('（备注）')).toBe('');
    });
  });
});
