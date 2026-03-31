import mockFs from 'mock-fs';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { cwd } from 'process';
import { writeMarkdown } from '../../../../module/generateReadme/writeMarkdown.ts';

describe('writeMarkdown', () => {
  const testMarkdownInfo = {
    liver: 'Test主播',
    uploader: 'TestUploader',
    content: '# Test Content\n\nThis is a test markdown.',
  };

  beforeEach(() => {
    mockFs({});
  });

  afterEach(() => {
    mockFs.restore();
  });

  it('should create docs/markdown directory if it does not exist', () => {
    const docsDirPath = resolve(cwd(), 'docs', 'markdown');
    expect(existsSync(docsDirPath)).toBe(false);

    writeMarkdown(testMarkdownInfo);

    expect(existsSync(docsDirPath)).toBe(true);
  });

  it('should use existing docs/markdown directory if it already exists', () => {
    const docsDirPath = resolve(cwd(), 'docs', 'markdown');
    mockFs({
      'docs': {
        'markdown': {}
      },
    });
    expect(existsSync(docsDirPath)).toBe(true);

    writeMarkdown(testMarkdownInfo);

    expect(existsSync(docsDirPath)).toBe(true);
  });

  it('should create liver directory if it does not exist', () => {
    const liverDirPath = resolve(cwd(), 'docs', 'markdown', testMarkdownInfo.liver);
    expect(existsSync(liverDirPath)).toBe(false);

    writeMarkdown(testMarkdownInfo);

    expect(existsSync(liverDirPath)).toBe(true);
  });

  it('should use existing liver directory if it already exists', () => {
    const liverDirPath = resolve(cwd(), 'docs', 'markdown', testMarkdownInfo.liver);
    mockFs({
      'docs': {
        'markdown': {
          [testMarkdownInfo.liver]: {},
        },
      },
    });
    expect(existsSync(liverDirPath)).toBe(true);

    writeMarkdown(testMarkdownInfo);

    expect(existsSync(liverDirPath)).toBe(true);
  });

  it('should write markdown file with correct content', () => {
    const expectedFilePath = resolve(
      cwd(),
      'docs',
      'markdown',
      testMarkdownInfo.liver,
      `${testMarkdownInfo.liver}直播回放列表(from ${testMarkdownInfo.uploader}).md`
    );

    writeMarkdown(testMarkdownInfo);

    expect(existsSync(expectedFilePath)).toBe(true);
    const writtenContent = readFileSync(expectedFilePath, 'utf-8');
    expect(writtenContent).toBe(testMarkdownInfo.content);
  });

  it('should handle liver name with special characters safely', () => {
    const maliciousInfo = {
      liver: '../etc/passwd',
      uploader: 'normalUploader',
      content: '# Malicious Test',
    };

    // The safeFilename should sanitize the path
    writeMarkdown(maliciousInfo);

    // The path should not traverse outside docs/markdown directory
    const liverDirPath = resolve(cwd(), 'docs', 'markdown', '.._etc_passwd');
    expect(existsSync(liverDirPath)).toBe(true);
  });

  it('should handle uploader name with special characters safely', () => {
    const maliciousInfo = {
      liver: 'normalLiver',
      uploader: '../../malicious',
      content: '# Malicious Test',
    };

    writeMarkdown(maliciousInfo);

    const expectedFilePath = resolve(
      cwd(),
      'docs',
      'markdown',
      maliciousInfo.liver,
      `${maliciousInfo.liver}直播回放列表(from .._.._malicious).md`
    );
    expect(existsSync(expectedFilePath)).toBe(true);
  });

  it('should handle empty content', () => {
    const emptyContentInfo = {
      liver: 'EmptyLiver',
      uploader: 'EmptyUploader',
      content: '',
    };

    writeMarkdown(emptyContentInfo);

    const expectedFilePath = resolve(
      cwd(),
      'docs',
      'markdown',
      emptyContentInfo.liver,
      `${emptyContentInfo.liver}直播回放列表(from ${emptyContentInfo.uploader}).md`
    );
    expect(existsSync(expectedFilePath)).toBe(true);
    const writtenContent = readFileSync(expectedFilePath, 'utf-8');
    expect(writtenContent).toBe('');
  });

  it('should handle multi-line markdown content', () => {
    const multiLineContent = `# Title

## Subtitle

- Item 1
- Item 2
- Item 3

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
`;
    const multiLineInfo = {
      liver: 'MultiLineLiver',
      uploader: 'MultiLineUploader',
      content: multiLineContent,
    };

    writeMarkdown(multiLineInfo);

    const expectedFilePath = resolve(
      cwd(),
      'docs',
      'markdown',
      multiLineInfo.liver,
      `${multiLineInfo.liver}直播回放列表(from ${multiLineInfo.uploader}).md`
    );
    const writtenContent = readFileSync(expectedFilePath, 'utf-8');
    expect(writtenContent).toBe(multiLineContent);
  });

  it('should overwrite existing file', () => {
    const liverDir = resolve(cwd(), 'docs', 'markdown', testMarkdownInfo.liver);
    const filePath = join(
      liverDir,
      `${testMarkdownInfo.liver}直播回放列表(from ${testMarkdownInfo.uploader}).md`
    );

    mockFs({
      'docs': {
        'markdown': {
          [testMarkdownInfo.liver]: {
            [`${testMarkdownInfo.liver}直播回放列表(from ${testMarkdownInfo.uploader}).md`]:
              'Old content',
          },
        },
      },
    });

    expect(existsSync(filePath)).toBe(true);
    const oldContent = readFileSync(filePath, 'utf-8');
    expect(oldContent).toBe('Old content');

    const newContent = '# New Content\n\nUpdated content here.';
    writeMarkdown({
      ...testMarkdownInfo,
      content: newContent,
    });

    const writtenContent = readFileSync(filePath, 'utf-8');
    expect(writtenContent).toBe(newContent);
  });
});
