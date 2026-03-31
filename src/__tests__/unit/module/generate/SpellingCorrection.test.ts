import { SpellingCorrection } from '../../../../module/generateReadme/SpellingCorrection';
import mockFs from 'mock-fs';

describe('SpellingCorrection V2', () => {
  afterEach(() => {
    mockFs.restore();
  });

  test('correct() applies global rule only', () => {
    const config = {
      version: '2.0',
      global: {
        rules: [{ from: 'data2', to: 'dota2' }]
      },
      uidRules: {}
    };
    mockFs({
      'node_modules': mockFs.load('node_modules'),
      'data': {
        'SpellingCorrections.json': JSON.stringify(config)
      }
    });

    const correction = new SpellingCorrection();
    const result = correction.correct('data2', 15810);
    
    expect(result).toBe('dota2');
  });

  test('correct() applies uid rule only', () => {
    const config = {
      version: '2.0',
      global: { rules: [] },
      uidRules: {
        '15810': {
          rules: [{ from: '塞尔达', to: '塞尔达传说：王国之泪' }]
        }
      }
    };
    mockFs({
      'node_modules': mockFs.load('node_modules'),
      'data': {
        'SpellingCorrections.json': JSON.stringify(config)
      }
    });

    const correction = new SpellingCorrection();
    const result = correction.correct('塞尔达', 15810);
    
    expect(result).toBe('塞尔达传说：王国之泪');
  });

  test('correct() chains uid rule then global rule', () => {
    const config = {
      version: '2.0',
      global: {
        rules: [{ from: '王国之泪', to: '塞尔达传说：王国之泪' }]
      },
      uidRules: {
        '15810': {
          rules: [{ from: '塞尔达', to: '王国之泪' }]
        }
      }
    };
    mockFs({
      'node_modules': mockFs.load('node_modules'),
      'data': {
        'SpellingCorrections.json': JSON.stringify(config)
      }
    });

    const correction = new SpellingCorrection();
    const result = correction.correct('塞尔达', 15810);
    
    // Should chain: 塞尔达 -> 王国之泪 -> 塞尔达传说：王国之泪
    expect(result).toBe('塞尔达传说：王国之泪');
  });

  test('correct() returns original when no rule matches', () => {
    const config = {
      version: '2.0',
      global: { rules: [] },
      uidRules: {}
    };
    mockFs({
      'node_modules': mockFs.load('node_modules'),
      'data': {
        'SpellingCorrections.json': JSON.stringify(config)
      }
    });

    const correction = new SpellingCorrection();
    const result = correction.correct('未知游戏', 15810);
    
    expect(result).toBe('未知游戏');
  });

  test('correct() applies global rule when uid has no matching rule', () => {
    const config = {
      version: '2.0',
      global: {
        rules: [{ from: '塞尔达', to: '塞尔达传说：旷野之息' }]
      },
      uidRules: {
        '15810': {
          rules: [{ from: '瓦', to: 'VALORANT' }]
        }
      }
    };
    mockFs({
      'node_modules': mockFs.load('node_modules'),
      'data': {
        'SpellingCorrections.json': JSON.stringify(config)
      }
    });

    const correction = new SpellingCorrection();
    // 690608693 doesn't have uid rule for "塞尔达"
    const result = correction.correct('塞尔达', 690608693);
    
    expect(result).toBe('塞尔达传说：旷野之息');
  });

  test('uses empty config when file does not exist', () => {
    mockFs({
      'node_modules': mockFs.load('node_modules'),
      'data': {}
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const correction = new SpellingCorrection();
    const result = correction.correct('data2', 15810);
    
    expect(result).toBe('data2');
    consoleSpy.mockRestore();
  });

  test('uses empty config when version is invalid', () => {
    const v1Config = { 'data2': 'dota2' };
    mockFs({
      'node_modules': mockFs.load('node_modules'),
      'data': {
        'SpellingCorrections.json': JSON.stringify(v1Config)
      }
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const correction = new SpellingCorrection();
    const result = correction.correct('data2', 15810);
    
    expect(result).toBe('data2');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
