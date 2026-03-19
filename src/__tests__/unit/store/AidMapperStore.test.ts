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
    it('should create empty mapper when file does not exist (legacy path)', () => {
      const store = new AidMapperStore(testUid);
      expect(store.getGameList('123')).toBeUndefined();
    });

    it('should create empty mapper when file does not exist (new path with userName)', () => {
      const store = new AidMapperStore(testUid, testUserName);
      expect(store.getGameList('123')).toBeUndefined();
    });

    it('should load existing mapper from file (legacy path)', () => {
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

    it('should load existing mapper from file (new path with userName)', () => {
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
    it('should add new aid entries (legacy path)', () => {
      const store = new AidMapperStore(testUid);
      store.update(['123', '456']);

      expect(store.getGameList('123')).toEqual([]);
      expect(store.getGameList('456')).toEqual([]);
    });

    it('should add new aid entries (new path with userName)', () => {
      const store = new AidMapperStore(testUid, testUserName);
      store.update(['123', '456']);

      expect(store.getGameList('123')).toEqual([]);
      expect(store.getGameList('456')).toEqual([]);
    });

    it('should not overwrite existing entries (legacy path)', () => {
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

    it('should not overwrite existing entries (new path with userName)', () => {
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
      const store = new AidMapperStore(testUid);
      store.update([]);

      expect(store.getGameList('any')).toBeUndefined();
    });

    it('should persist changes to file (legacy path)', () => {
      const store = new AidMapperStore(testUid);
      store.update(['123']);

      const newStore = new AidMapperStore(testUid);
      expect(newStore.getGameList('123')).toEqual([]);
    });

    it('should persist changes to file (new path with userName)', () => {
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
    it('should return game list for existing aid (string) - legacy path', () => {
      mockFs({
        'config': {
          [`${testUid}.aid.json`]: JSON.stringify({
            '123': ['Game1', 'Game2'],
          })
        }
      });

      const store = new AidMapperStore(testUid);
      expect(store.getGameList('123')).toEqual(['Game1', 'Game2']);
    });

    it('should return game list for existing aid (string) - new path with userName', () => {
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
        'config': {
          [`${testUid}.aid.json`]: JSON.stringify({
            '123': ['Game1', 'Game2'],
          })
        }
      });

      const store = new AidMapperStore(testUid);
      expect(store.getGameList(123)).toEqual(['Game1', 'Game2']);
    });

    it('should return undefined for non-existing aid', () => {
      mockFs({
        'config': {
          [`${testUid}.aid.json`]: JSON.stringify({
            '123': ['Game1', 'Game2'],
          })
        }
      });

      const store = new AidMapperStore(testUid);
      expect(store.getGameList('999')).toBeUndefined();
    });
  });
});
