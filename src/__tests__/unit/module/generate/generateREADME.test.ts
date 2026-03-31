import mockFs from 'mock-fs';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { cwd } from 'process';
import { generateREADME } from '../../../../module/generateReadme/generateREADME.ts';

describe('generateREADME', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console.info to prevent file system access through jest console
    consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    mockFs({});
  });

  afterEach(() => {
    mockFs.restore();
    consoleSpy.mockRestore();
  });

  it('should generateReadme README with correct directory structure', () => {
    // Setup mock file system with docs/markdown directory structure
    mockFs({
      'docs': {
        'markdown': {
          'Mr.Quin': {
            'Mr.Quin直播回放列表(from 自行车二层).md': '# Mr.Quin Content',
            'Mr.Quin直播回放列表(from 胧黑).md': '# Mr.Quin Content 2',
          },
          '机皇': {
            '机皇直播回放列表(from 胧黑).md': '# 机皇 Content',
          },
        },
      },
    });

    generateREADME();

    const readmeFilePath = resolve(cwd(), 'README.md');
    expect(existsSync(readmeFilePath)).toBe(true);

    const content = readFileSync(readmeFilePath, 'utf-8');

    // Verify group directory structure
    expect(content).toContain('- [[**Mr.Quin**]](./docs/markdown/Mr.Quin):');
    expect(content).toContain('- [[**机皇**]](./docs/markdown/机皇):');

    // Verify markdown links are generated
    expect(content).toContain('[Mr.Quin直播回放列表(from 自行车二层)]');
    expect(content).toContain('[Mr.Quin直播回放列表(from 胧黑)]');
    expect(content).toContain('[机皇直播回放列表(from 胧黑)]');
  });

  it('should handle empty docs/markdown directory', () => {
    mockFs({
      'docs': {
        'markdown': {},
      },
    });

    generateREADME();

    const readmeFilePath = resolve(cwd(), 'README.md');
    expect(existsSync(readmeFilePath)).toBe(true);

    const content = readFileSync(readmeFilePath, 'utf-8');

    // Verify README is generated with empty group section
    expect(content).toContain('# Bilibili UP直播录播分组列表');
    expect(content).toContain('## 分组目录');
    // Group section should be empty but present
    expect(content).toMatch(/## 分组目录\s*\n\n## 项目描述/);
  });

  it('should encode URI in markdown links correctly', () => {
    // Setup with special characters that need encoding
    mockFs({
      'docs': {
        'markdown': {
          'Test主播': {
            'Test直播回放列表(from 录播Man).md': '# Test Content',
          },
        },
      },
    });

    generateREADME();

    const readmeFilePath = resolve(cwd(), 'README.md');
    const content = readFileSync(readmeFilePath, 'utf-8');

    // Verify URI encoding for special characters
    // Chinese characters should be encoded
    expect(content).toContain(encodeURI('./docs/markdown/Test主播/'));
    expect(content).toContain(encodeURI('./docs/markdown/Test主播/Test直播回放列表(from 录播Man).md'));
  });

  it('should generateReadme group directory with nested structure', () => {
    mockFs({
      'docs': {
        'markdown': {
          '主播A': {
            '主播A直播回放列表(from 上传者1).md': '# Content 1',
            '主播A直播回放列表(from 上传者2).md': '# Content 2',
            '主播A直播回放列表(from 上传者3).md': '# Content 3',
          },
          '主播B': {
            '主播B直播回放列表(from 上传者1).md': '# Content 4',
          },
        },
      },
    });

    generateREADME();

    const readmeFilePath = resolve(cwd(), 'README.md');
    const content = readFileSync(readmeFilePath, 'utf-8');

    // Verify group structure with tabs for nested items
    expect(content).toContain('- [[**主播A**]](./docs/markdown/主播A):');
    expect(content).toContain('- [[**主播B**]](./docs/markdown/主播B):');

    // Verify nested items with tabs
    expect(content).toContain('\t- [主播A直播回放列表(from 上传者1)]');
    expect(content).toContain('\t- [主播A直播回放列表(from 上传者2)]');
    expect(content).toContain('\t- [主播A直播回放列表(from 上传者3)]');
    expect(content).toContain('\t- [主播B直播回放列表(from 上传者1)]');
  });

  it('should write README.md file with correct content', () => {
    mockFs({
      'docs': {
        'markdown': {
          'Test主播': {
            'Test直播回放列表(from TestUploader).md': '# Test',
          },
        },
      },
    });

    generateREADME();

    const readmeFilePath = resolve(cwd(), 'README.md');
    expect(existsSync(readmeFilePath)).toBe(true);

    const content = readFileSync(readmeFilePath, 'utf-8');

    // Verify README header
    expect(content).toContain('# Bilibili UP直播录播分组列表');
    expect(content).toContain('## 分组目录');
    expect(content).toContain('## 项目描述');

    // Verify project description is included
    expect(content).toContain('本项目通过识别本人/录播Man上传的带游戏名的直播录像视频');
    expect(content).toContain('## 本项目监听对象');
    expect(content).toContain('## 功能');
    expect(content).toContain('## 纠错');
    expect(content).toContain('## Build');
  });

  it('should handle filenames with .md extension correctly', () => {
    mockFs({
      'docs': {
        'markdown': {
          '主播': {
            '主播直播回放列表(from 上传者).md': '# Content',
          },
        },
      },
    });

    generateREADME();

    const readmeFilePath = resolve(cwd(), 'README.md');
    const content = readFileSync(readmeFilePath, 'utf-8');

    // Verify .md extension is removed from display title but kept in link
    expect(content).toContain('[主播直播回放列表(from 上传者)]');
    expect(content).not.toContain('[主播直播回放列表(from 上传者).md]');
    expect(content).toContain(encodeURI('./docs/markdown/主播/主播直播回放列表(from 上传者).md'));
  });

  it('should overwrite existing README.md', () => {
    mockFs({
      'README.md': '# Old README\n\nOld content here.',
      'docs': {
        'markdown': {
          '主播': {
            '主播直播回放列表(from 上传者).md': '# Content',
          },
        },
      },
    });

    const readmeFilePath = resolve(cwd(), 'README.md');
    const oldContent = readFileSync(readmeFilePath, 'utf-8');
    expect(oldContent).toContain('# Old README');

    generateREADME();

    const newContent = readFileSync(readmeFilePath, 'utf-8');
    expect(newContent).not.toContain('# Old README');
    expect(newContent).toContain('# Bilibili UP直播录播分组列表');
  });

  it('should log info message when generating README', () => {
    mockFs({
      'docs': {
        'markdown': {
          '主播': {
            '主播直播回放列表(from 上传者).md': '# Content',
          },
        },
      },
    });

    generateREADME();

    expect(consoleSpy).toHaveBeenCalledWith('更新README成功');
  });

  it('should handle multiple liver directories correctly', () => {
    mockFs({
      'docs': {
        'markdown': {
          'Mr.Quin': {
            'Mr.Quin直播回放列表(from 自行车二层).md': '# Content',
          },
          '机皇': {
            '机皇直播回放列表(from 胧黑).md': '# Content',
          },
          '机智的肯尼': {
            '机智的肯尼直播回放列表(from 自行车二层).md': '# Content',
          },
          '北极熊剩饭': {
            '北极熊剩饭直播回放列表(from 自行车二层).md': '# Content',
          },
          '勾檀Mayumi': {
            '勾檀Mayumi直播回放列表(from 勾檀Mayumi).md': '# Content',
          },
        },
      },
    });

    generateREADME();

    const readmeFilePath = resolve(cwd(), 'README.md');
    const content = readFileSync(readmeFilePath, 'utf-8');

    // Verify all liver directories are included
    expect(content).toContain('- [[**Mr.Quin**]](./docs/markdown/Mr.Quin):');
    expect(content).toContain('- [[**机皇**]](./docs/markdown/机皇):');
    expect(content).toContain('- [[**机智的肯尼**]](./docs/markdown/机智的肯尼):');
    expect(content).toContain('- [[**北极熊剩饭**]](./docs/markdown/北极熊剩饭):');
    expect(content).toContain('- [[**勾檀Mayumi**]](./docs/markdown/勾檀Mayumi):');
  });
});
