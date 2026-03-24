import { EntryAnalyzer } from "../analyzer/entryAnalyzer";
import { VariableGraphBuilder } from "../analyzer/variableGraphBuilder";
import * as fs from "fs";
import * as path from "path";

// 创建测试文件
describe("EntryAnalyzer", () => {
  const testDir = path.join(__dirname, "__test_files__");
  
  beforeAll(() => {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // 创建入口文件
    fs.writeFileSync(
      path.join(testDir, "index.ts"),
      `
import { add, multiply } from "./math";

const x = 10;
const y = 20;

function calculate() {
  const sum = add(x, y);
  const result = multiply(sum, 2);
  return result;
}

export { calculate };
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
  return a * b;
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

  test("应该分析入口文件及依赖", () => {
    const analyzer = new EntryAnalyzer();
    const entryFile = path.join(testDir, "index.ts");
    
    const { moduleGraph, contexts } = analyzer.analyze(entryFile);

    // 验证模块数量
    expect(moduleGraph.modules.size).toBe(2);
    
    // 验证入口模块存在
    expect(moduleGraph.modules.has(entryFile)).toBe(true);
    
    // 验证 math 模块存在
    const mathFile = path.join(testDir, "math.ts");
    expect(moduleGraph.modules.has(mathFile)).toBe(true);
    
    // 验证上下文被收集
    expect(contexts.size).toBe(2);
  });

  test("应该构建变量图谱", () => {
    const analyzer = new EntryAnalyzer();
    const entryFile = path.join(testDir, "index.ts");
    
    const { moduleGraph, contexts } = analyzer.analyze(entryFile);
    
    const builder = new VariableGraphBuilder(moduleGraph, contexts);
    const graph = builder.build();

    // 验证有节点
    expect(graph.nodes.length).toBeGreaterThan(0);
    
    // 验证有边
    expect(graph.edges.length).toBeGreaterThan(0);
    
    // 验证节点包含函数
    const functionNodes = graph.nodes.filter(n => n.kind === "function");
    expect(functionNodes.length).toBeGreaterThanOrEqual(2); // add, multiply
    
    // 验证节点包含变量
    const varNodes = graph.nodes.filter(n => n.kind === "const" || n.kind === "let" || n.kind === "var");
    expect(varNodes.length).toBeGreaterThanOrEqual(2); // x, y
  });

  test("应该生成 DOT 格式", () => {
    const analyzer = new EntryAnalyzer();
    const entryFile = path.join(testDir, "index.ts");
    
    const { moduleGraph, contexts } = analyzer.analyze(entryFile);
    
    const builder = new VariableGraphBuilder(moduleGraph, contexts);
    const dot = builder.toDotFormat();

    // 验证 DOT 格式包含 digraph
    expect(dot).toContain("digraph VariableGraph");
    expect(dot).toContain("node [shape=box]");
  });
});
