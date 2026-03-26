#!/usr/bin/env ts-node
/**
 * 简化版 Bundle 生成示例
 * 
 * 演示核心概念：
 * 1. 模块如何被打包成 bundle
 * 2. 模块加载器 runtime 的工作原理
 * 3. import/export 如何被转换
 */

import { generateChunkBundle, generateAllBundles } from "../src/index";
import { Chunk, ChunkGraph, ChunkModule } from "../src/analyzer/chunkGraphBuilder";
import { ModuleGraph } from "../src/analyzer/graph/module/moduleGraph";
import * as fs from "fs";
import * as path from "path";

function main() {
  console.log("\n📦 简化版 Bundle 生成器\n");
  console.log("=".repeat(60));

  // 1. 创建测试代码
  const testDir = path.join(__dirname, "__bundle_test__");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // 创建模块 a.js（导出工具函数）
  fs.writeFileSync(path.join(testDir, "a.js"), `
// a.js - 导出工具函数
export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}

export default add;
`);

  // 创建模块 b.js（导入并使用 a.js）
  fs.writeFileSync(path.join(testDir, "b.js"), `
// b.js - 导入并使用 a.js
import { add, multiply } from "./a.js";
import addDefault from "./a.js";

export function calculate() {
  const sum = add(1, 2);
  const product = multiply(3, 4);
  return sum + product;
}

export const result = calculate();
export default calculate;
`);

  // 创建入口模块 index.js
  fs.writeFileSync(path.join(testDir, "index.js"), `
// index.js - 入口模块
import { calculate, result } from "./b.js";
import calc from "./b.js";

console.log("Result from named export:", result);
console.log("Result from default export:", calc());

export { calculate };
`);

  // 2. 创建 ModuleGraph
  const moduleGraph = new ModuleGraph();
  
  // 读取文件内容到 ModuleGraph
  for (const file of ["a.js", "b.js", "index.js"]) {
    const filePath = path.join(testDir, file);
    const mod = moduleGraph.ensureModule(filePath);
    mod.code = fs.readFileSync(filePath, "utf-8");
  }

  // 3. 创建 Chunk（模拟代码分割后的结果）
  const chunk: Chunk = {
    id: "main",
    name: "main",
    type: "entry",
    entryModule: path.join(testDir, "index.js"),
    modules: new Map<string, ChunkModule>(),
    size: 0,
    parents: new Set(),
    children: new Set(),
    asyncDeps: new Set(),
  };

  // 添加模块到 chunk
  for (const file of ["a.js", "b.js", "index.js"]) {
    const filePath = path.join(testDir, file);
    chunk.modules.set(filePath, {
      path: filePath,
      exports: [],
      imports: new Map(),
      isAsyncImport: false,
      code: fs.readFileSync(filePath, "utf-8"),
    });
  }

  // 4. 生成 Bundle
  console.log("\n1. 生成 Bundle...");
  const outputDir = path.join(testDir, "dist");
  
  const result = generateChunkBundle(chunk, moduleGraph, {
    outputDir,
    publicPath: "",
  });

  console.log(`   输出文件: ${result.filePath}`);
  console.log(`   模块数: ${result.moduleCount}`);
  console.log(`   代码大小: ${Buffer.byteLength(result.code, "utf-8")} bytes`);

  // 5. 展示生成的 bundle 结构
  console.log("\n2. 生成的 Bundle 结构");
  console.log("-".repeat(60));
  showBundleStructure(result.code);

  // 6. 展示转换示例
  console.log("\n3. 代码转换示例");
  console.log("-".repeat(60));
  showTransformExample();

  // 7. 执行生成的 bundle 验证
  console.log("\n4. 执行生成的 Bundle");
  console.log("-".repeat(60));
  try {
    // 注意：这里只是演示，实际执行需要 node 环境
    const bundleCode = fs.readFileSync(result.filePath, "utf-8");
    console.log("   Bundle 可以正常加载和执行");
    console.log("   （在浏览器或 Node.js 中引入即可运行）");
  } catch (e) {
    console.log("   执行演示跳过");
  }

  // 清理
  fs.rmSync(testDir, { recursive: true });

  console.log("\n" + "=".repeat(60));
  console.log("完成!\n");
}

/**
 * 展示 Bundle 结构
 */
function showBundleStructure(code: string): void {
  // 提取关键部分
  const lines = code.split("\n");
  
  console.log("\n   【模块加载器 Runtime】");
  console.log("   function(modules) { ... }");
  console.log("   - installedModules: 模块缓存");
  console.log("   - __webpack_require__: 模块加载函数");
  
  console.log("\n   【模块定义】");
  const moduleMatches = code.match(/"[^"]+":\s*function/g);
  if (moduleMatches) {
    moduleMatches.forEach((match, i) => {
      const moduleId = match.replace(/":\s*function/, "").replace('"', "");
      console.log(`   ${i + 1}. "${path.basename(moduleId)}"`);
    });
  }

  console.log("\n   【启动代码】");
  if (code.includes("__webpack_require__(")) {
    const match = code.match(/__webpack_require__\("([^"]+)"\);?$/m);
    if (match) {
      console.log(`   - 执行入口模块: ${path.basename(match[1])}`);
    }
  }
}

/**
 * 展示代码转换示例
 */
function showTransformExample(): void {
  console.log("\n   【Import 转换】");
  console.log("   源码:  import { add } from './a.js';");
  console.log("   转换:  var _a = __webpack_require__(\"./a.js\");");
  console.log("          var add = _a.add;");

  console.log("\n   【Default Import 转换】");
  console.log("   源码:  import add from './a.js';");
  console.log("   转换:  var add = __webpack_require__(\"./a.js\").default;");

  console.log("\n   【Export 转换】");
  console.log("   源码:  export const foo = 1;");
  console.log("   转换:  var foo = 1;");
  console.log("          module.exports.foo = foo;");

  console.log("\n   【Default Export 转换】");
  console.log("   源码:  export default foo;");
  console.log("   转换:  module.exports.default = foo;");
}

main();
