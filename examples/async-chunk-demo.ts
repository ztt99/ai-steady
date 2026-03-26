#!/usr/bin/env ts-node
/**
 * 异步 Chunk 加载原理演示
 * 
 * 核心概念：
 * 1. 主 chunk 包含所有同步模块
 * 2. 异步 chunk 单独打包，按需加载
 * 3. 通过 __webpack_require__.e(chunkId) 加载异步 chunk
 * 4. 加载完成后执行模块代码
 */

import * as fs from "fs";
import * as path from "path";

// ============ 1. 创建示例代码 ============

const testDir = path.join(__dirname, "__async_chunk__");
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

// 主模块（入口）
fs.writeFileSync(path.join(testDir, "main.js"), `
// 同步加载工具模块
import { log } from "./utils.js";

log("App started");

// 异步加载功能模块（点击按钮时加载）
async function loadFeature() {
  log("Loading feature...");
  
  // 动态导入，会生成 async-chunk
  const feature = await import("./feature.js");
  
  feature.doSomething();
}

// 模拟点击
document.getElementById("btn").onclick = loadFeature;
`);

// 工具模块（同步 chunk）
fs.writeFileSync(path.join(testDir, "utils.js"), `
export function log(msg) {
  console.log("[LOG]", msg);
}

export function formatDate(date) {
  return date.toISOString();
}
`);

// 功能模块（异步 chunk）
fs.writeFileSync(path.join(testDir, "feature.js"), `
// 这个模块会被打包到单独的异步 chunk
import { log } from "./utils.js";

export function doSomething() {
  log("Feature is working!");
  return "result";
}

export const featureVersion = "1.0.0";
`);

// ============ 2. 生成主 Bundle（简化版） ============

const mainBundle = `
// ==================== 模块加载器 Runtime ====================
(function(modules) {
  // 模块缓存
  var installedModules = {};
  
  // 异步 chunk 缓存: { chunkId: [resolve, reject, promise] }
  var installedChunks = {};

  // 同步模块加载器
  function __webpack_require__(moduleId) {
    if (installedModules[moduleId]) {
      return installedModules[moduleId].exports;
    }
    var module = installedModules[moduleId] = {
      i: moduleId,
      l: false,
      exports: {}
    };
    modules[moduleId](module, module.exports, __webpack_require__);
    module.l = true;
    return module.exports;
  }

  // ==================== 异步 Chunk 加载核心 ====================
  // 
  // 这是关键函数！它会动态创建 script 标签加载异步 chunk
  // 返回 Promise，加载完成后 resolve
  //
  __webpack_require__.e = function requireEnsure(chunkId) {
    var promises = [];
    
    // 检查 chunk 是否已加载
    var installedChunkData = installedChunks[chunkId];
    
    // 0 表示已加载
    if (installedChunkData !== 0) {
      
      // 正在加载中，返回已有的 Promise
      if (installedChunkData) {
        promises.push(installedChunkData[2]);
      } 
      // 未加载过，创建新的 Promise 并开始加载
      else {
        // 创建 Promise，并保存 resolve/reject
        var promise = new Promise(function(resolve, reject) {
          installedChunkData = installedChunks[chunkId] = [resolve, reject];
        });
        promises.push(installedChunkData[2] = promise);
        
        // 动态创建 script 标签加载 chunk
        var script = document.createElement('script');
        script.src = __webpack_require__.p + "chunk-" + chunkId + ".js";
        
        // 加载完成/失败处理
        script.onload = function() {
          installedChunks[chunkId] = 0; // 标记为已加载
          resolve(); // 通知 Promise 完成
        };
        script.onerror = function() {
          reject(new Error("Load chunk " + chunkId + " failed"));
        };
        
        document.head.appendChild(script);
      }
    }
    
    return Promise.all(promises);
  };

  // 公共路径配置
  __webpack_require__.p = "";

  // ==================== 模块定义 ====================
  return __webpack_require__;
})({
  // 主模块
  "./main.js": function(module, exports, __webpack_require__) {
    var utils = __webpack_require__("./utils.js");
    utils.log("App started");
    
    // 动态导入：先加载异步 chunk，再执行模块
    document.getElementById("btn").onclick = function() {
      // __webpack_require__.e("feature") 返回 Promise
      __webpack_require__.e("feature").then(function() {
        // chunk 加载完成后，再加载模块
        var feature = __webpack_require__("./feature.js");
        feature.doSomething();
      });
    };
  },
  
  // 同步模块：工具函数
  "./utils.js": function(module, exports) {
    exports.log = function(msg) { console.log("[LOG]", msg); };
    exports.formatDate = function(date) { return date.toISOString(); };
  }
});
`;

fs.mkdirSync(path.join(testDir, "dist"), { recursive: true });
fs.writeFileSync(path.join(testDir, "dist", "main.bundle.js"), mainBundle);

// ============ 3. 生成异步 Chunk（简化版） ============

const asyncChunk = `
// ==================== 异步 Chunk: feature ====================
// 
// 这个文件是动态加载的！只有在调用 __webpack_require__.e("feature") 时才会加载
//

// Webpack JSONP 回调：将模块注册到主 chunk 的 modules 对象中
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([
  // chunk ID
  "feature",
  
  // 这个 chunk 包含的模块
  {
    "./feature.js": function(module, exports, __webpack_require__) {
      // 依赖同步模块 utils
      var utils = __webpack_require__("./utils.js");
      
      exports.doSomething = function() {
        utils.log("Feature is working!");
        return "result";
      };
      
      exports.featureVersion = "1.0.0";
    }
  }
]);
`;

fs.writeFileSync(path.join(testDir, "dist", "chunk-feature.js"), asyncChunk);

// ============ 4. 简化版 HTML 演示 ============

const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Async Chunk Demo</title>
</head>
<body>
  <h1>异步 Chunk 加载演示</h1>
  <button id="btn">加载功能模块</button>
  
  <!-- 先加载主 bundle -->
  <script src="main.bundle.js"></script>
  
  <!-- 
    点击按钮后，才会动态创建 script 标签加载 chunk-feature.js
    可以在 DevTools Network 面板观察到
  -->
</body>
</html>
`;

fs.writeFileSync(path.join(testDir, "dist", "index.html"), html);

// ============ 5. 核心逻辑总结 ============

console.log("\n" + "=".repeat(60));
console.log("异步 Chunk 加载原理演示");
console.log("=".repeat(60));

console.log("\n📁 生成的文件：");
console.log(`  ${testDir}/dist/`);
console.log(`    ├── main.bundle.js    (主 chunk，包含同步模块)`);
console.log(`    ├── chunk-feature.js  (异步 chunk，按需加载)`);
console.log(`    └── index.html        (演示页面)`);

console.log("\n🔄 加载流程：");
console.log(`
  1. 页面加载 main.bundle.js
     └── 包含同步模块 (main.js, utils.js)
     └── 包含模块加载器 runtime
     └── 包含异步加载函数 __webpack_require__.e()

  2. 用户点击按钮
     └── 调用 import("./feature.js")
     └── 转换为 __webpack_require__.e("feature")

  3. 加载异步 chunk
     └── 创建 <script src="chunk-feature.js">
     └── 等待加载完成
     └── Promise resolve

  4. 执行模块代码
     └── __webpack_require__("./feature.js")
     └── 执行 doSomething()
`);

console.log("\n💡 核心代码逻辑：");
console.log(`
  // 异步加载函数（简化版）
  __webpack_require__.e = function(chunkId) {
    return new Promise(function(resolve, reject) {
      // 创建 script 标签
      var script = document.createElement('script');
      script.src = "chunk-" + chunkId + ".js";
      
      // 加载完成
      script.onload = function() {
        resolve();  // Promise 完成
      };
      
      document.head.appendChild(script);
    });
  };
`);

console.log("\n🔑 关键点：");
console.log("  1. 异步 chunk 是按需加载的，减少初始加载时间");
console.log("  2. 通过 Promise 管理加载状态");
console.log("  3. 使用 JSONP 方式将模块注入主 chunk");
console.log("  4. 缓存机制避免重复加载");

// 清理
fs.rmSync(testDir, { recursive: true });

console.log("\n" + "=".repeat(60));
console.log("演示完成！\n");
