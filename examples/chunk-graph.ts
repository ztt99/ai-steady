#!/usr/bin/env ts-node
/**
 * Chunk Graph 分析示例
 *
 * 演示代码分割、异步加载、chunk 依赖关系分析
 */

import {
  analyzeEntry,
  analyzeChunkGraph,
  generateChunkGraphReport,
  ChunkGraphBuilder,
  EntryAnalyzer,
  ChunkGraph,
} from "../src/index";
import * as fs from "fs";
import * as path from "path";

function main() {
  const entryFile = process.argv[2] || "./src/index.ts";

  console.log(`\n📦 Chunk Graph 分析: ${entryFile}\n`);
  console.log("=".repeat(60));

  // 1. 分析入口
  console.log("\n1. 分析入口文件...");
  const analyzer = new EntryAnalyzer();
  const { moduleGraph } = analyzer.analyze(entryFile);
  console.log(`   发现 ${moduleGraph.modules.size} 个模块`);

  // 2. 构建 Chunk Graph
  console.log("\n2. 构建 Chunk Graph...");
  const chunkGraph = analyzeChunkGraph({ main: entryFile }, moduleGraph);

  console.log(`   生成 ${chunkGraph.chunks.size} 个 chunks`);
  console.log(`   Entry chunks: ${chunkGraph.entryChunks.size}`);
  console.log(`   依赖边: ${chunkGraph.edges.length}`);

  // 3. 打印 Chunk Graph 报告
  console.log("\n3. Chunk Graph 报告");
  console.log("-".repeat(60));
  const report = generateChunkGraphReport(chunkGraph);
  console.log(report);

  // 4. 详细 Chunk 信息
  console.log("\n4. 详细 Chunk 信息");
  console.log("-".repeat(60));

  for (const [chunkId, chunk] of chunkGraph.chunks) {
    console.log(`\n📦 ${chunk.name} (${chunk.type})`);
    console.log(`   ID: ${chunkId}`);
    console.log(`   模块数: ${chunk.modules.size}`);
    console.log(`   估算大小: ${(chunk.size / 1024).toFixed(2)} KB`);

    if (chunk.parents.size > 0) {
      console.log(`   父 chunks: ${Array.from(chunk.parents).join(", ")}`);
    }

    if (chunk.children.size > 0) {
      console.log(`   子 chunks: ${Array.from(chunk.children).join(", ")}`);
    }

    if (chunk.asyncDeps.size > 0) {
      console.log(`   异步依赖: ${Array.from(chunk.asyncDeps).join(", ")}`);
    }

    // 显示模块列表（前5个）
    const moduleList = Array.from(chunk.modules.keys()).slice(0, 5);
    console.log(`   模块列表 (前5个):`);
    for (const mod of moduleList) {
      console.log(`     - ${path.basename(mod)}`);
    }
    if (chunk.modules.size > 5) {
      console.log(`     ... 还有 ${chunk.modules.size - 5} 个`);
    }
  }

  // 5. 演示带代码分割的 Chunk Graph
  console.log("\n5. 代码分割演示");
  console.log("-".repeat(60));
  demonstrateCodeSplitting();

  // 6. 导出可视化数据
  console.log("\n6. 导出可视化数据");
  console.log("-".repeat(60));

  const outputDir = "./output";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 导出为 JSON
  const exportData = {
    chunks: Array.from(chunkGraph.chunks.entries()).map(([id, chunk]) => ({
      id,
      name: chunk.name,
      type: chunk.type,
      size: chunk.size,
      moduleCount: chunk.modules.size,
      parents: Array.from(chunk.parents),
      children: Array.from(chunk.children),
      asyncDeps: Array.from(chunk.asyncDeps),
    })),
    edges: chunkGraph.edges,
  };

  const jsonPath = path.join(outputDir, "chunk-graph.json");
  fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
  console.log(`   Chunk Graph JSON: ${jsonPath}`);

  // 生成 DOT 格式
  const dot = generateChunkGraphDot(chunkGraph);
  const dotPath = path.join(outputDir, "chunk-graph.dot");
  fs.writeFileSync(dotPath, dot);
  console.log(`   Chunk Graph DOT: ${dotPath}`);
  console.log(`   可视化: dot -Tpng ${dotPath} -o ${path.join(outputDir, "chunk-graph.png")}`);

  console.log("\n" + "=".repeat(60));
  console.log("分析完成!\n");
}

/**
 * 演示代码分割场景
 */
function demonstrateCodeSplitting(): void {
  const testDir = path.join(__dirname, "__chunk_test__");

  // 创建测试文件
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // 创建 vendors 模块（模拟 node_modules）
  const vendorsDir = path.join(testDir, "node_modules", "lodash");
  fs.mkdirSync(vendorsDir, { recursive: true });
  fs.writeFileSync(
    path.join(vendorsDir, "index.js"),
    `
export function debounce() {}
export function throttle() {}
export function cloneDeep() {}
`,
  );

  // 创建共享模块
  fs.writeFileSync(
    path.join(testDir, "shared", "utils.js"),
    `
export function formatDate() {}
export function formatNumber() {}
`,
  );

  // 创建页面 A
  fs.writeFileSync(
    path.join(testDir, "pages", "pageA.js"),
    `
import { debounce } from "lodash";
import { formatDate } from "../shared/utils";
import("./pageA-async.js"); // 动态导入

export function initPageA() {
  console.log("Page A");
}
`,
  );

  fs.writeFileSync(
    path.join(testDir, "pages", "pageA-async.js"),
    `
export function asyncComponent() {
  return "Async Component A";
}
`,
  );

  // 创建页面 B
  fs.writeFileSync(
    path.join(testDir, "pages", "pageB.js"),
    `
import { throttle } from "lodash";
import { formatNumber } from "../shared/utils";
import("./pageB-async.js"); // 动态导入

export function initPageB() {
  console.log("Page B");
}
`,
  );

  fs.writeFileSync(
    path.join(testDir, "pages", "pageB-async.js"),
    `
export function asyncComponent() {
  return "Async Component B";
}
`,
  );

  // 创建入口
  fs.writeFileSync(
    path.join(testDir, "index.js"),
    `
import { initPageA } from "./pages/pageA";
import { initPageB } from "./pages/pageB";

initPageA();
initPageB();
`,
  );

  console.log("   创建测试文件结构:");
  console.log(`     ${testDir}/`);
  console.log(`       node_modules/lodash/`);
  console.log(`       shared/utils.js`);
  console.log(`       pages/pageA.js (+ async)`);
  console.log(`       pages/pageB.js (+ async)`);
  console.log(`       index.js`);

  // 分析
  const entryFile = path.join(testDir, "index.js");
  const analyzer = new EntryAnalyzer();
  const { moduleGraph } = analyzer.analyze(entryFile);

  // 构建 Chunk Graph（带代码分割）
  const chunkBuilder = new ChunkGraphBuilder(moduleGraph, {
    entries: { main: entryFile },
    splitChunks: {
      vendors: /node_modules/,
      minChunks: 2,
      cacheGroups: [
        {
          name: "shared",
          test: /shared/,
          priority: 10,
        },
      ],
    },
  });

  const chunkGraph = chunkBuilder.build();

  console.log("\n   代码分割结果:");
  for (const [chunkId, chunk] of chunkGraph.chunks) {
    console.log(`     ${chunk.name} (${chunk.type}): ${chunk.modules.size} 个模块`);
  }

  console.log("\n   Chunk 依赖关系:");
  for (const edge of chunkGraph.edges) {
    console.log(`     ${edge.from} ${edge.type === "dynamic" ? "~>" : "->"} ${edge.to}`);
  }

  // 清理
  fs.rmSync(testDir, { recursive: true });
  console.log("\n   (测试文件已清理)");
}

/**
 * 生成 Chunk Graph 的 DOT 格式
 */
function generateChunkGraphDot(graph: ChunkGraph): string {
  const lines: string[] = [];

  lines.push("digraph ChunkGraph {");
  lines.push("  rankdir=TB;");
  lines.push('  node [shape=box, style="rounded,filled"];');
  lines.push("");

  // 定义 chunk 节点
  for (const [chunkId, chunk] of graph.chunks) {
    const color = getChunkColor(chunk.type);
    const size = (chunk.size / 1024).toFixed(1);
    const label = `${chunk.name}\\n${chunk.modules.size} modules\\n${size} KB`;
    lines.push(`  "${chunkId}" [label="${label}", fillcolor="${color}"];`);
  }

  lines.push("");

  // 定义边
  for (const edge of graph.edges) {
    const style = edge.type === "dynamic" ? "dashed" : "solid";
    const color = edge.type === "dynamic" ? "red" : "black";
    lines.push(`  "${edge.from}" -> "${edge.to}" [style=${style}, color=${color}];`);
  }

  lines.push("}");

  return lines.join("\n");
}

function getChunkColor(type: string): string {
  const colors: Record<string, string> = {
    entry: "#90EE90",
    async: "#FFD700",
    vendor: "#87CEEB",
    common: "#DDA0DD",
  };
  return colors[type] || "#FFFFFF";
}

main();
