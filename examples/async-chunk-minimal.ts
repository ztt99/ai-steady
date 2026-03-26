#!/usr/bin/env ts-node
/**
 * 异步 Chunk 加载 - 极简版（核心逻辑仅 30 行）
 */

// ========== 核心：异步加载函数（30行） ==========
const ASYNC_LOADER = `
// 异步 chunk 缓存: { chunkId: Promise }
var installedChunks = {};

// 异步加载函数 - 核心！
function loadChunk(chunkId) {
  // 已加载？返回 resolved Promise
  if (installedChunks[chunkId] === 0) return Promise.resolve();
  
  // 正在加载？返回已有 Promise
  if (installedChunks[chunkId]) return installedChunks[chunkId][2];
  
  // 开始加载
  var promise = new Promise(function(resolve, reject) {
    installedChunks[chunkId] = [resolve, reject];
  });
  installedChunks[chunkId][2] = promise;
  
  // 创建 script 标签加载 chunk
  var script = document.createElement('script');
  script.src = "chunk-" + chunkId + ".js";
  script.onload = function() { installedChunks[chunkId] = 0; resolve(); };
  script.onerror = function(e) { reject(e); };
  document.head.appendChild(script);
  
  return promise;
}
`;

// ========== 演示 ==========
console.log("=" .repeat(50));
console.log("异步 Chunk 加载 - 极简版");
console.log("=" .repeat(50));

console.log("\n【核心代码 - 30行实现】\n");
console.log(ASYNC_LOADER);

console.log("\n【使用方式】\n");
console.log(`
// 1. 定义异步 chunk 文件（chunk-feature.js）
webpackJsonp.push(["feature", {
  "./feature.js": function(module, exports) {
    exports.run = function() { console.log("Feature!"); };
  }
}]);

// 2. 主代码中按需加载
loadChunk("feature").then(function() {
  // chunk 加载完成，执行模块
  var feature = __webpack_require__("./feature.js");
  feature.run();  // 输出: Feature!
});
`);

console.log("\n【关键点】\n");
console.log("1. installedChunks - 缓存避免重复加载");
console.log("2. Promise - 处理异步加载");
console.log("3. script.onload - 通知加载完成");
console.log("4. webpackJsonp - 将模块注册到主 bundle");

console.log("\n" + "=".repeat(50));
