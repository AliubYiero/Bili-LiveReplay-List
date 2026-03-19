import { validateSpellingCorrection, validateSpellingCorrectionV2 } from '../../../utils/configValidator';

describe('validateSpellingCorrection', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should return valid configuration object', () => {
    const validConfig = {
      'oldName': 'newName',
      'another': 'corrected',
    };
    expect(validateSpellingCorrection(validConfig)).toEqual(validConfig);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should return empty object and warn for invalid configuration', () => {
    const invalidConfig = [1, 2, 3];
    expect(validateSpellingCorrection(invalidConfig)).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '配置文件格式错误，使用空配置:',
      expect.any(Object)
    );
  });

  it('should return empty object for null input', () => {
    expect(validateSpellingCorrection(null)).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('should return empty object for undefined input', () => {
    expect(validateSpellingCorrection(undefined)).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('should return empty object for number input', () => {
    expect(validateSpellingCorrection(123)).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('should return empty object for string input', () => {
    expect(validateSpellingCorrection('config')).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('should return empty object for empty object', () => {
    expect(validateSpellingCorrection({})).toEqual({});
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should handle nested values (but still require string values)', () => {
    const mixedConfig = {
      valid: 'value',
      invalid: 123,
    };
    expect(validateSpellingCorrection(mixedConfig)).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalled();
  });
});

describe('validateSpellingCorrectionV2', () => {
  test('validates correct V2 config', () => {
    const validConfig = {
      version: '2.0',
      global: {
        rules: [
          { from: 'data2', to: 'dota2' },
          { from: '塞尔达', to: '塞尔达传说：旷野之息' }
        ]
      },
      uidRules: {
        '15810': {
          rules: [
            { from: '塞尔达', to: '塞尔达传说：王国之泪' }
          ]
        }
      }
    };
    
    const result = validateSpellingCorrectionV2(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('2.0');
      expect(result.data.global.rules).toHaveLength(2);
      expect(result.data.uidRules['15810'].rules).toHaveLength(1);
    }
  });

  test('returns error for V1 config format', () => {
    const v1Config = {
      'data2': 'dota2',
      '塞尔达': '塞尔达传说：旷野之息'
    };
    
    const result = validateSpellingCorrectionV2(v1Config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('version');
    }
  });

  test('returns error for missing version', () => {
    const invalidConfig = {
      global: { rules: [] },
      uidRules: {}
    };
    
    const result = validateSpellingCorrectionV2(invalidConfig);
    expect(result.success).toBe(false);
  });

  test('returns error for invalid rule structure', () => {
    const invalidConfig = {
      version: '2.0',
      global: {
        rules: [
          { from: 'data2' } // missing 'to'
        ]
      },
      uidRules: {}
    };
    
    const result = validateSpellingCorrectionV2(invalidConfig);
    expect(result.success).toBe(false);
  });

  test('validates empty rules array', () => {
    const config = {
      version: '2.0',
      global: { rules: [] },
      uidRules: {}
    };
    
    const result = validateSpellingCorrectionV2(config);
    expect(result.success).toBe(true);
  });
});
