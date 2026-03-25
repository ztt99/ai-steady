#!/usr/bin/env ts-node
/**
 * Tree-shaking 分析示例
 * 演示如何分析未使用的代码
 */

import {
  analyzeTreeShaking,
  generateTreeShakingReport,
  analyzeEntry,
} from "../src/index";
import * as fs from "fs";
import * as path from "path";

function main() {
  // 从命令行获取入口文件
  const entryFile = process.argv[2] || "./src/index.ts";

  console.log(`\n🔍 Tree-shaking 分析: ${entryFile}\n`);
  console.log("=".repeat(60));

  // 1. 首先分析入口，获取模块图
  console.log("\n1. 分析入口文件...");
  const { moduleGraph } = analyzeEntry(entryFile);
  console.log(`   发现 ${moduleGraph.modules.size} 个模块`);

  // 2. 执行 tree-shaking 分析
  console.log("\n2. 执行 Tree-shaking 分析...");
  const result = analyzeTreeShaking([entryFile], {
    sideEffects: [
      "*.css",
      "*.scss",
      "*.less",
      /polyfill/,
      /side-effect/,
    ],
  });

  // 3. 生成并打印报告
  console.log("\n3. 分析报告");
  console.log("-".repeat(60));
  const report = generateTreeShakingReport(result);
  console.log(report);

  // 4. 导出详细结果到 JSON
  console.log("\n4. 导出详细结果");
  console.log("-".repeat(60));

  const outputDir = "./output";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "tree-shaking-report.json");
  const exportableResult = {
    stats: result.stats,
    usedExports: Array.from(result.usedExports.entries()).map(
      ([file, exports]) => ({ file, exports: Array.from(exports) })
    ),
    unusedExports: Array.from(result.unusedExports.entries()).map(
      ([file, exports]) => ({ file, exports: Array.from(exports) })
    ),
    unusedImports: Array.from(result.unusedImports.entries()).map(
      ([file, imports]) => ({ file, imports: Array.from(imports) })
    ),
    deadModules: Array.from(result.deadModules),
    sideEffectModules: Array.from(result.sideEffectModules),
  };

  fs.writeFileSync(outputPath, JSON.stringify(exportableResult, null, 2));
  console.log(`   详细报告已保存: ${outputPath}`);

  // 5. 显示可优化建议
  console.log("\n5. 优化建议");
  console.log("-".repeat(60));

  const suggestions: string[] = [];

  // 死模块建议
  if (result.deadModules.size > 0) {
    suggestions.push(
      `发现 ${result.deadModules.size} 个死模块，可以完全移除`
    );
  }

  // 未使用导出建议
  let totalUnusedExports = 0;
  for (const exports of result.unusedExports.values()) {
    totalUnusedExports += exports.size;
  }
  if (totalUnusedExports > 0) {
    suggestions.push(
      `发现 ${totalUnusedExports} 个未使用的导出，建议移除以减小包体积`
    );
  }

  // 未使用导入建议
  let totalUnusedImports = 0;
  for (const imports of result.unusedImports.values()) {
    totalUnusedImports += imports.size;
  }
  if (totalUnusedImports > 0) {
    suggestions.push(
      `发现 ${totalUnusedImports} 个未使用的导入，建议清理以改善代码质量`
    );
  }

  // 副作用模块建议
  if (result.sideEffectModules.size > 0) {
    suggestions.push(
      `有 ${result.sideEffectModules.size} 个副作用模块，检查是否可以重构为纯模块以获得更好的 tree-shaking 效果`
    );
  }

  if (suggestions.length === 0) {
    console.log("   ✅ 代码库很干净，没有发现可优化项！");
  } else {
    for (const suggestion of suggestions) {
      console.log(`   • ${suggestion}`);
    }
  }

  // 6. 包体积预估
  console.log("\n6. 包体积优化预估");
  console.log("-".repeat(60));
  const deadCodePercent = result.stats.deadCodePercentage;
  console.log(`   死代码占比: ${deadCodePercent.toFixed(2)}%`);
  console.log(`   预估可减小体积: ~${deadCodePercent.toFixed(0)}%`);

  if (deadCodePercent > 50) {
    console.log("   ⚠️ 死代码超过 50%，强烈建议进行代码清理！");
  } else if (deadCodePercent > 20) {
    console.log("   💡 死代码超过 20%，建议审查无用代码");
  } else {
    console.log("   ✅ 死代码比例在合理范围内");
  }

  console.log("\n" + "=".repeat(60));
  console.log("分析完成!\n");
}

main();
