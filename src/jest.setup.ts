import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';

// 设置测试环境
process.env.NODE_ENV = 'test';

const testConfigDir = resolve(process.cwd(), 'config-test');

beforeAll(() => {
	if (existsSync(testConfigDir)) {
		rmSync(testConfigDir, { recursive: true });
	}
});

afterAll(() => {
	if (existsSync(testConfigDir)) {
		rmSync(testConfigDir, { recursive: true });
	}
});
