import { validateSpellingCorrection } from '../../../utils/configValidator';

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
