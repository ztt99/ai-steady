import { TreeShakingAnalyzer } from "../analyzer/treeShakingAnalyzer";
import { ModuleGraph } from "../analyzer/graph/module/moduleGraph";
import { EntryAnalyzer } from "../analyzer/entryAnalyzer";
import * as fs from "fs";
import * as path from "path";

describe("TreeShakingAnalyzer", () => {
  const testDir = path.join(__dirname, "__tree_shaking_test__");

  beforeAll(() => {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // 创建入口文件
    fs.writeFileSync(
      path.join(testDir, "index.ts"),
      `
import { add } from "./math";
import { helper } from "./utils"; // 未使用的导入
import "./side-effect"; // 副作用导入

const result = add(1, 2);
console.log(result);
`
    );

    // 创建 math.ts
    fs.writeFileSync(
      path.join(testDir, "math.ts"),
      `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b; // 未使用的导出
}
`
    );

    // 创建 utils.ts
    fs.writeFileSync(
      path.join(testDir, "utils.ts"),
      `
export function helper() {
  return "help";
}

export function unusedHelper() {
  return "unused";
}
`
    );

    // 创建 side-effect.ts
    fs.writeFileSync(
      path.join(testDir, "side-effect.ts"),
      `
console.log("side effect executed");
export const value = 1;
`
    );

    // 创建未使用的模块
    fs.writeFileSync(
      path.join(testDir, "dead-module.ts"),
      `
export function deadFunction() {
  return "never used";
}
`
    );
  });

  afterAll(() => {
    // 清理测试文件
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  test("应该识别未使用的导出", () => {
    const entryFile = path.join(testDir, "index.ts");
    const analyzer = new EntryAnalyzer();
    const { moduleGraph, contexts } = analyzer.analyze(entryFile);

    const treeShaker = new TreeShakingAnalyzer(moduleGraph, contexts);
    const result = treeShaker.analyze([entryFile]);

    // math.ts 中的 multiply 应该未被使用
    const mathUnused = result.unusedExports.get(path.join(testDir, "math.ts"));
    expect(mathUnused).toBeDefined();
    expect(mathUnused!.has("multiply")).toBe(true);

    // add 应该被使用
    expect(mathUnused!.has("add")).toBe(false);
  });

  test("应该识别未使用的导入", () => {
    const entryFile = path.join(testDir, "index.ts");
    const analyzer = new EntryAnalyzer();
    const { moduleGraph, contexts } = analyzer.analyze(entryFile);

    const treeShaker = new TreeShakingAnalyzer(moduleGraph, contexts);
    const result = treeShaker.analyze([entryFile]);

    // index.ts 中的 helper 导入应该未被使用
    const indexUnusedImports = result.unusedImports.get(entryFile);
    expect(indexUnusedImports).toBeDefined();
    expect(indexUnusedImports!.has("helper")).toBe(true);
  });

  test("应该识别死模块", () => {
    const entryFile = path.join(testDir, "index.ts");
    const analyzer = new EntryAnalyzer();
    const { moduleGraph, contexts } = analyzer.analyze(entryFile);

    // 添加死模块到 moduleGraph
    const deadModulePath = path.join(testDir, "dead-module.ts");
    moduleGraph.ensureModule(deadModulePath);

    const treeShaker = new TreeShakingAnalyzer(moduleGraph, contexts);
    const result = treeShaker.analyze([entryFile]);

    // dead-module.ts 应该是死模块
    expect(result.deadModules.has(deadModulePath)).toBe(true);
  });

  test("应该识别副作用模块", () => {
    const entryFile = path.join(testDir, "index.ts");
    const analyzer = new EntryAnalyzer();
    const { moduleGraph, contexts } = analyzer.analyze(entryFile);

    const treeShaker = new TreeShakingAnalyzer(moduleGraph, contexts);
    const result = treeShaker.analyze([entryFile], {
      sideEffects: ["side-effect"],
    });

    // side-effect.ts 应该被标记为副作用模块
    expect(
      result.sideEffectModules.has(path.join(testDir, "side-effect.ts"))
    ).toBe(true);
  });

  test("应该生成正确的统计信息", () => {
    const entryFile = path.join(testDir, "index.ts");
    const analyzer = new EntryAnalyzer();
    const { moduleGraph, contexts } = analyzer.analyze(entryFile);

    const treeShaker = new TreeShakingAnalyzer(moduleGraph, contexts);
    const result = treeShaker.analyze([entryFile]);

    // 验证统计数据
    expect(result.stats.totalExports).toBeGreaterThan(0);
    expect(result.stats.usedExportsCount).toBeGreaterThanOrEqual(0);
    expect(result.stats.deadCodePercentage).toBeGreaterThanOrEqual(0);
    expect(result.stats.deadCodePercentage).toBeLessThanOrEqual(100);
  });

  test("应该生成报告", () => {
    const entryFile = path.join(testDir, "index.ts");
    const analyzer = new EntryAnalyzer();
    const { moduleGraph, contexts } = analyzer.analyze(entryFile);

    const treeShaker = new TreeShakingAnalyzer(moduleGraph, contexts);
    const result = treeShaker.analyze([entryFile]);
    const report = treeShaker.generateReport(result);

    expect(report).toContain("Tree-shaking 分析报告");
    expect(report).toContain("统计信息");
  });
});
