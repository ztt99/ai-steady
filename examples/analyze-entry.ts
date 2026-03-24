#!/usr/bin/env ts-node
/**
 * 入口文件分析示例
 * 演示如何从入口文件分析生成变量图谱
 */

import { analyzeEntry, analyzeCallChain, analyzeImpact } from "../src/index";
import * as fs from "fs";
import * as path from "path";

// 示例：分析一个入口文件
function main() {
  // 假设有一个入口文件
  const entryFile = process.argv[2] || "./src/index.ts";
  
  console.log(`\n分析入口文件: ${entryFile}\n`);
  console.log("=".repeat(60));

  // 1. 基本分析
  console.log("\n1. 基础分析");
  console.log("-".repeat(40));
  
  const result = analyzeEntry(entryFile);
  
  console.log(`总节点数: ${result.graph.nodes.length}`);
  console.log(`总边数: ${result.graph.edges.length}`);
  console.log(`模块数: ${result.moduleGraph.modules.size}`);

  // 2. 查看所有变量
  console.log("\n2. 变量列表");
  console.log("-".repeat(40));
  
  const varsByKind: Record<string, string[]> = {};
  for (const node of result.graph.nodes) {
    if (!varsByKind[node.kind]) varsByKind[node.kind] = [];
    varsByKind[node.kind].push(`${node.name} (${path.basename(node.module)})`);
  }
  
  for (const [kind, vars] of Object.entries(varsByKind)) {
    console.log(`\n${kind}:`);
    for (const v of vars.slice(0, 10)) {
      console.log(`  - ${v}`);
    }
    if (vars.length > 10) {
      console.log(`  ... 还有 ${vars.length - 10} 个`);
    }
  }

  // 3. 查看依赖关系
  console.log("\n3. 依赖关系");
  console.log("-".repeat(40));
  
  const deps = result.graph.edges.filter(e => e.type === "dependency");
  const calls = result.graph.edges.filter(e => e.type === "call");
  const imports = result.graph.edges.filter(e => e.type === "import");
  
  console.log(`数据依赖: ${deps.length}`);
  console.log(`函数调用: ${calls.length}`);
  console.log(`模块导入: ${imports.length}`);

  // 4. 打印部分依赖边
  console.log("\n4. 示例依赖边（前10条）");
  console.log("-".repeat(40));
  
  for (const edge of result.graph.edges.slice(0, 10)) {
    const from = result.graph.nodes.find(n => n.id === edge.from);
    const to = result.graph.nodes.find(n => n.id === edge.to);
    console.log(`${edge.type}: ${from?.name} -> ${to?.name}`);
  }

  // 5. 生成 DOT 文件（用于可视化）
  console.log("\n5. 生成可视化文件");
  console.log("-".repeat(40));
  
  const dot = result.toDot();
  const outputDir = "./output";
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const dotPath = path.join(outputDir, "variable-graph.dot");
  fs.writeFileSync(dotPath, dot);
  console.log(`DOT 文件已保存: ${dotPath}`);
  console.log("可以使用 Graphviz 渲染: dot -Tpng variable-graph.dot -o graph.png");

  // 6. 示例：分析特定函数的调用链
  const targetFunc = process.argv[3];
  if (targetFunc) {
    console.log(`\n6. 函数 '${targetFunc}' 的调用链分析`);
    console.log("-".repeat(40));
    
    const { found, chain } = analyzeCallChain(entryFile, targetFunc);
    
    if (found) {
      console.log(`找到 ${chain.length} 个相关函数:`);
      for (const node of chain) {
        console.log(`  - ${node.name} (${path.basename(node.module)})`);
      }
    } else {
      console.log(`未找到函数: ${targetFunc}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("分析完成!\n");
}

main();
