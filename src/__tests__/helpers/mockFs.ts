import mockFs from 'mock-fs';

type MockFsTree = Parameters<typeof mockFs>[0];

/**
 * 为什么必须保留 node_modules：
 * `@jest/console` 在首次 console 调用时会懒加载 `jest-util`，
 * 这一步的模块解析会被已挂载的 mock-fs 拦截，于是报
 * `ENOENT ... /node_modules/.pnpm/@jest+console@*\/node_modules/jest-util`。
 *
 * 但整棵真实 node_modules 的递归遍历很慢（实测单次约 4s），
 * 所以把 `mockFs.load('node_modules')` 的结果缓存起来，
 * 同一个 worker 里只加载一次，后续挂载直接复用。
 */
const NODE_MODULES_CACHE_KEY = '__biliMockFsNodeModulesTree';

function getNodeModulesTree(): MockFsTree {
	const cache = process as unknown as Record<string, unknown>;
	if (!cache[NODE_MODULES_CACHE_KEY]) {
		cache[NODE_MODULES_CACHE_KEY] = mockFs.load('node_modules');
	}
	return cache[NODE_MODULES_CACHE_KEY] as MockFsTree;
}

/**
 * 挂载一个 mock 文件系统。会自动带上 node_modules（供 Jest 内部使用）。
 * 需要隔离文件系统时统一走这个 helper，不要直接调用 `mockFs()`。
 */
export function mountFs(tree: Record<string, unknown>): void {
	mockFs({ node_modules: getNodeModulesTree() as never, ...tree } as MockFsTree);
}
