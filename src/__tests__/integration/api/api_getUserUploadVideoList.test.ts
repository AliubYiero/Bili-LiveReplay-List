import nock from 'nock';
import { api_getUserUploadVideoList } from '../../../api/api_getUserUploadVideoList';

describe('api_getUserUploadVideoList', () => {
  const testUid = 12345;
  const apiBaseUrl = 'https://api.bilibili.com';

  afterEach(() => {
    nock.cleanAll();
  });

  describe('successful response', () => {
    it('should return video list with hasNext flag', async () => {
      const mockResponse = {
        code: 0,
        message: 'success',
        data: {
          archives: [
            {
              aid: 123,
              bvid: 'BV123',
              title: 'Test Video',
              desc: 'Test Description',
              pic: 'http://example.com/pic.jpg',
              pubdate: 1700000000,
              ctime: 1700000000,
              duration: 3600,
              state: 0,
              upMid: testUid,
              stat: { view: 1000 },
              enable_vt: 0,
              ugc_pay: 0,
              playback_position: 0,
              vt_display: '',
              interactive_video: false,
            }
          ],
          page: {
            num: 1,
            size: 30,
            total: 50,
          }
        }
      };

      nock(apiBaseUrl)
        .get('/x/series/recArchivesByKeywords')
        .query(true)
        .reply(200, mockResponse);

      const result = await api_getUserUploadVideoList(testUid, 1, 30);

      expect(result.archives).toHaveLength(1);
      expect(result.archives[0].title).toBe('Test Video');
      expect(result.page.total).toBe(50);
      expect(result.hasNext).toBe(true);
    });

    it('should set hasNext to false when all items fetched', async () => {
      const mockResponse = {
        code: 0,
        message: 'success',
        data: {
          archives: [],
          page: {
            num: 2,
            size: 30,
            total: 30,
          }
        }
      };

      nock(apiBaseUrl)
        .get('/x/series/recArchivesByKeywords')
        .query(true)
        .reply(200, mockResponse);

      const result = await api_getUserUploadVideoList(testUid, 2, 30);

      expect(result.hasNext).toBe(false);
    });

    it('should limit pageSize to maximum 100', async () => {
      const mockResponse = {
        code: 0,
        message: 'success',
        data: {
          archives: [],
          page: { num: 1, size: 100, total: 0 }
        }
      };

      nock(apiBaseUrl)
        .get('/x/series/recArchivesByKeywords')
        .query((query) => query.ps === '100')
        .reply(200, mockResponse);

      await api_getUserUploadVideoList(testUid, 1, 200);
    });
  });

  describe('error handling', () => {
    it('should throw error when API returns non-zero code', async () => {
      const mockResponse = {
        code: -1,
        message: 'Invalid request',
        data: null
      };

      nock(apiBaseUrl)
        .get('/x/series/recArchivesByKeywords')
        .query(true)
        .reply(200, mockResponse);

      await expect(api_getUserUploadVideoList(testUid))
        .rejects.toThrow('Invalid request');
    });

    it('should throw error on network timeout', async () => {
      nock(apiBaseUrl)
        .get('/x/series/recArchivesByKeywords')
        .query(true)
        .replyWithError(new Error('Connection timed out'));

      await expect(api_getUserUploadVideoList(testUid))
        .rejects.toThrow();
    });

    it('should throw error on 5xx server error', async () => {
      nock(apiBaseUrl)
        .get('/x/series/recArchivesByKeywords')
        .query(true)
        .reply(500, { error: 'Internal Server Error' });

      await expect(api_getUserUploadVideoList(testUid))
        .rejects.toThrow();
    });
  });
});
