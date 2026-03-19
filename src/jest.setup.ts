import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';

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
