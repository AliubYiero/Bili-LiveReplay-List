import * as mockFs from 'mock-fs';
import { AidMapperStore } from '../../../store/AidMapperStore';

describe('AidMapperStore', () => {
  const testUid = 12345;

  beforeEach(() => {
    mockFs({
      'config': {}
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe('initialization', () => {
    it('should create empty mapper when file does not exist', () => {
      const store = new AidMapperStore(testUid);
      expect(store.getGameList('123')).toBeUndefined();
    });

    it('should load existing mapper from file', () => {
      mockFs({
        'config': {
          [`${testUid}.aid.json`]: JSON.stringify({
            '123': ['Game1', 'Game2'],
            '456': ['Game3']
          })
        }
      });

      const store = new AidMapperStore(testUid);
      expect(store.getGameList('123')).toEqual(['Game1', 'Game2']);
      expect(store.getGameList('456')).toEqual(['Game3']);
    });
  });

  describe('update', () => {
    it('should add new aid entries', () => {
      const store = new AidMapperStore(testUid);
      store.update(['123', '456']);

      expect(store.getGameList('123')).toEqual([]);
      expect(store.getGameList('456')).toEqual([]);
    });

    it('should not overwrite existing entries', () => {
      mockFs({
        'config': {
          [`${testUid}.aid.json`]: JSON.stringify({
            '123': ['ExistingGame']
          })
        }
      });

      const store = new AidMapperStore(testUid);
      store.update(['123', '456']);

      expect(store.getGameList('123')).toEqual(['ExistingGame']);
      expect(store.getGameList('456')).toEqual([]);
    });

    it('should handle empty array', () => {
      const store = new AidMapperStore(testUid);
      store.update([]);

      expect(store.getGameList('any')).toBeUndefined();
    });

    it('should persist changes to file', () => {
      const store = new AidMapperStore(testUid);
      store.update(['123']);

      const newStore = new AidMapperStore(testUid);
      expect(newStore.getGameList('123')).toEqual([]);
    });
  });

  describe('getGameList', () => {
    beforeEach(() => {
      mockFs({
        'config': {
          [`${testUid}.aid.json`]: JSON.stringify({
            '123': ['Game1', 'Game2'],
          })
        }
      });
    });

    it('should return game list for existing aid (string)', () => {
      const store = new AidMapperStore(testUid);
      expect(store.getGameList('123')).toEqual(['Game1', 'Game2']);
    });

    it('should return game list for existing aid (number)', () => {
      const store = new AidMapperStore(testUid);
      expect(store.getGameList(123)).toEqual(['Game1', 'Game2']);
    });

    it('should return undefined for non-existing aid', () => {
      const store = new AidMapperStore(testUid);
      expect(store.getGameList('999')).toBeUndefined();
    });
  });
});
