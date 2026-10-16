// 设置测试环境
// 该标记被 scripts/ 下的入口读取, 用于跳过真实副作用 (启动服务 / 执行主流程)
process.env.NODE_ENV = 'test';
