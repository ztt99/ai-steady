#!/usr/bin/env ts-node
/**
 * 跨模块影响分析示例
 * 
 * 演示场景：
 * a.js 导出 n
 * b.js 导入 n 并使用
 * 当 a.js 中的 n 变化时，分析 b.js 中的 n 如何受影响
 */

import {
  analyzeCrossModuleImpact,
  printCrossModuleLinks,
  analyzeEntry,
  EntryAnalyzer,
  ModuleLinker,
  CrossModuleImpactAnalyzer,
} from "../src/index";
import * as fs from "fs";
import * as path from "path";

function main() {
  const entryFile = process.argv[2] || "./src/index.ts";
  const targetVar = process.argv[3]; // 例如: "n" 或 "./src/a.js::n"

  console.log(`\n🔗 跨模块影响分析: ${entryFile}\n`);
  console.log("=".repeat(60));

  // 1. 打印所有跨模块链接
  console.log("\n1. 所有跨模块实时绑定 (Live Binding)");
  console.log("-".repeat(60));
  const linksReport = printCrossModuleLinks(entryFile);
  console.log(linksReport);

  // 2. 如果指定了目标变量，分析其影响
  if (targetVar) {
    console.log(`\n2. 分析变量 '${targetVar}' 的跨模块影响`);
    console.log("-".repeat(60));

    const { found, result, liveBindingInfo } = analyzeCrossModuleImpact(
      entryFile,
      targetVar
    );

    if (!found) {
      console.log(`未找到变量: ${targetVar}`);
      return;
    }

    // 显示实时绑定信息
    console.log("\n📋 实时绑定信息:");
    console.log(`   是导入的: ${liveBindingInfo?.isImported}`);
    console.log(`   是导出的: ${liveBindingInfo?.isExported}`);
    
    if (liveBindingInfo?.isImported) {
      console.log(`   源模块: ${liveBindingInfo.sourceModule}`);
      console.log(`   源变量: ${liveBindingInfo.sourceBinding?.name}`);
    }
    
    if (liveBindingInfo?.isExported) {
      console.log(`   被 ${liveBindingInfo.importedBy.length} 个 binding 导入`);
      console.log(`   影响模块: ${liveBindingInfo.importedByModules.join(", ")}`);
    }

    // 显示影响分析结果
    if (result) {
      console.log("\n📊 影响分析结果:");
      console.log(`   直接影响: ${result.directImpacts.length} 个 binding`);
      console.log(`   跨模块影响: ${result.crossModuleImpacts.size} 个模块`);
      console.log(`   影响链数量: ${result.impactChains.length}`);
      console.log(`   总影响 binding 数: ${result.allImpactedBindings.size}`);

      // 显示跨模块影响详情
      if (result.crossModuleImpacts.size > 0) {
        console.log("\n📦 跨模块影响详情:");
        for (const [moduleId, bindings] of result.crossModuleImpacts) {
          console.log(`   ${moduleId}:`);
          for (const binding of bindings) {
            console.log(`     - ${binding.name}`);
          }
        }
      }

      // 显示影响链
      if (result.impactChains.length > 0) {
        console.log("\n⛓️ 影响传播链 (前5条):");
        for (const chain of result.impactChains.slice(0, 5)) {
          const chainStr = chain
            .map((b) => `${b.name}(${path.basename(b.moduleId || "unknown")})`)
            .join(" -> ");
          console.log(`   ${chainStr}`);
        }
      }
    }
  }

  // 3. 演示：创建测试文件并分析
  console.log("\n3. 创建测试场景演示");
  console.log("-".repeat(60));
  demonstrateLiveBinding();

  console.log("\n" + "=".repeat(60));
  console.log("分析完成!\n");
}

/**
 * 创建测试文件演示实时绑定
 */
function demonstrateLiveBinding() {
  const testDir = path.join(__dirname, "__live_binding_test__");

  // 创建测试目录
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // 创建 a.js - 导出 n
  fs.writeFileSync(
    path.join(testDir, "a.js"),
    `
// a.js - 导出变量 n
export let n = 1;

export function updateN(value) {
  n = value;
}

export const config = {
  value: n
};
`
  );

  // 创建 b.js - 导入 n
  fs.writeFileSync(
    path.join(testDir, "b.js"),
    `
// b.js - 导入并使用 n
import { n, updateN } from "./a.js";

export function useN() {
  console.log(n); // 使用 n
  return n * 2;
}

export function changeN() {
  updateN(100); // 修改 n
}

export const derived = n + 1; // 依赖 n
`
  );

  // 创建入口文件
  fs.writeFileSync(
    path.join(testDir, "index.js"),
    `
// 入口文件
import { n, updateN } from "./a.js";
import { useN, changeN } from "./b.js";

console.log(n);
useN();
changeN();
`
  );

  console.log("   创建测试文件:");
  console.log(`     - ${path.join(testDir, "a.js")} (导出 n)`);
  console.log(`     - ${path.join(testDir, "b.js")} (导入 n)`);
  console.log(`     - ${path.join(testDir, "index.js")} (入口)`);

  // 分析测试文件
  const entryFile = path.join(testDir, "index.js");
  const analyzer = new EntryAnalyzer();
  const { moduleGraph, contexts } = analyzer.analyze(entryFile);

  // 链接模块
  const linker = new ModuleLinker(moduleGraph);
  linker.link();

  // 分析跨模块链接
  const impactAnalyzer = new CrossModuleImpactAnalyzer(moduleGraph, contexts);
  const links = impactAnalyzer.findAllCrossModuleLinks();

  console.log("\n   发现的跨模块绑定:");
  for (const link of links) {
    console.log(`     ${link.exportName}:`);
    console.log(`       ${link.sourceModule} -> ${link.targetModule}`);
    console.log(`       (实时绑定: 当 ${link.sourceModule} 的 ${link.exportName} 变化时，`);
    console.log(`        ${link.targetModule} 的 ${link.target.name} 也会变化)`);
  }

  // 分析 n 的影响
  const aModule = moduleGraph.modules.get(path.join(testDir, "a.js"));
  if (aModule) {
    for (const binding of aModule.bindings) {
      if (binding.name === "n") {
        console.log("\n   变量 'n' 的实时绑定详情:");
        const info = impactAnalyzer.getLiveBindingInfo(binding);
        console.log(`     导出: ${info.isExported}`);
        console.log(`     被导入到: ${info.importedByModules.join(", ")}`);

        // 分析影响
        const impact = impactAnalyzer.analyze(binding);
        console.log(`     影响范围: ${impact.allImpactedBindings.size} 个 binding`);
        break;
      }
    }
  }

  // 清理
  fs.rmSync(testDir, { recursive: true });
  console.log("\n   (测试文件已清理)");
}

main();
