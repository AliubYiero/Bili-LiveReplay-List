import { safeFilename } from '../../../utils/filename';

describe('safeFilename', () => {
  it('should return valid filename unchanged', () => {
    expect(safeFilename('normalFile')).toBe('normalFile');
  });

  it('should replace invalid characters with underscore', () => {
    expect(safeFilename('file:name')).toBe('file_name');
    expect(safeFilename('file/name')).toBe('file_name');
    expect(safeFilename('file\\name')).toBe('file_name');
    expect(safeFilename('file<name>')).toBe('file_name_');
    expect(safeFilename('file"name"')).toBe('file_name_');
    expect(safeFilename('file|name')).toBe('file_name');
    expect(safeFilename('file?name')).toBe('file_name');
    expect(safeFilename('file*name')).toBe('file_name');
  });

  it('should handle multiple invalid characters', () => {
    expect(safeFilename('file:/\\<>"|?*name')).toBe('file_________name');
  });

  it('should preserve Chinese characters', () => {
    expect(safeFilename('中文文件名')).toBe('中文文件名');
  });

  it('should handle empty string', () => {
    expect(safeFilename('')).toBe('');
  });

  it('should handle spaces', () => {
    expect(safeFilename('file name')).toBe('file name');
  });

  it('should handle dots', () => {
    expect(safeFilename('file.name.txt')).toBe('file.name.txt');
  });
});
