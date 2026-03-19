import mockFs from 'mock-fs';
import { AidMapperStore } from '../../../store/AidMapperStore';

describe('AidMapperStore', () => {
  const testUid = 12345;
  const testUserName = '测试用户';

  beforeEach(() => {
    mockFs({
      'config': {},
      'data': {}
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe('initialization', () => {
    it('should create empty mapper when file does not exist', () => {
      const store = new AidMapperStore(testUid, testUserName);
      expect(store.getGameList('123')).toBeUndefined();
    });

    it('should load existing mapper from file', () => {
      mockFs({
        'data': {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({
              '123': ['Game1', 'Game2'],
              '456': ['Game3']
            })
          }
        }
      });

      const store = new AidMapperStore(testUid, testUserName);
      expect(store.getGameList('123')).toEqual(['Game1', 'Game2']);
      expect(store.getGameList('456')).toEqual(['Game3']);
    });
  });

  describe('update', () => {
    it('should add new aid entries', () => {
      const store = new AidMapperStore(testUid, testUserName);
      store.update(['123', '456']);

      expect(store.getGameList('123')).toEqual([]);
      expect(store.getGameList('456')).toEqual([]);
    });

    it('should not overwrite existing entries', () => {
      mockFs({
        'data': {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({
              '123': ['ExistingGame']
            })
          }
        }
      });

      const store = new AidMapperStore(testUid, testUserName);
      store.update(['123', '456']);

      expect(store.getGameList('123')).toEqual(['ExistingGame']);
      expect(store.getGameList('456')).toEqual([]);
    });

    it('should handle empty array', () => {
      const store = new AidMapperStore(testUid, testUserName);
      store.update([]);

      expect(store.getGameList('any')).toBeUndefined();
    });

    it('should persist changes to file', () => {
      mockFs({
        'data': {}
      });

      const store = new AidMapperStore(testUid, testUserName);
      store.update(['123']);

      const newStore = new AidMapperStore(testUid, testUserName);
      expect(newStore.getGameList('123')).toEqual([]);
    });
  });

  describe('getGameList', () => {
    it('should return game list for existing aid (string)', () => {
      mockFs({
        'data': {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({
              '123': ['Game1', 'Game2'],
            })
          }
        }
      });

      const store = new AidMapperStore(testUid, testUserName);
      expect(store.getGameList('123')).toEqual(['Game1', 'Game2']);
    });

    it('should return game list for existing aid (number)', () => {
      mockFs({
        'data': {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({
              '123': ['Game1', 'Game2'],
            })
          }
        }
      });

      const store = new AidMapperStore(testUid, testUserName);
      expect(store.getGameList(123)).toEqual(['Game1', 'Game2']);
    });

    it('should return undefined for non-existing aid', () => {
      mockFs({
        'data': {
          [testUid.toString()]: {
            [`${testUserName}.aid.json`]: JSON.stringify({
              '123': ['Game1', 'Game2'],
            })
          }
        }
      });

      const store = new AidMapperStore(testUid, testUserName);
      expect(store.getGameList('999')).toBeUndefined();
    });
  });
});
