# 入口文件分析和 Graph 生成

## 功能概述

从入口文件开始，递归分析所有依赖模块，构建完整的变量依赖图谱。

## 核心组件

### 1. EntryAnalyzer
从入口文件递归分析所有依赖模块。

```typescript
import { EntryAnalyzer } from "./analyzer/entryAnalyzer";

const analyzer = new EntryAnalyzer();
const { moduleGraph, contexts } = analyzer.analyze("./src/index.ts");

console.log(`分析了 ${analyzer.getModuleCount()} 个模块`);
```

### 2. VariableGraphBuilder
构建跨模块的变量依赖图。

```typescript
import { VariableGraphBuilder } from "./analyzer/variableGraphBuilder";

const builder = new VariableGraphBuilder(moduleGraph, contexts);
const graph = builder.build();

console.log(`节点数: ${graph.nodes.length}`);
console.log(`边数: ${graph.edges.length}`);
```

### 3. 便捷 API（入口文件分析）

#### 分析入口文件
```typescript
import { analyzeEntry } from "./index";

const { graph, moduleGraph, toDot } = analyzeEntry("./src/index.ts");

// 生成可视化文件
const dot = toDot();
fs.writeFileSync("graph.dot", dot);
```

#### 分析函数调用链
```typescript
import { analyzeCallChain } from "./index";

const { found, chain } = analyzeCallChain("./src/index.ts", "main");

if (found) {
  for (const node of chain) {
    console.log(`${node.name} (${node.module})`);
  }
}
```

#### 分析变量影响范围
```typescript
import { analyzeImpact } from "./index";

const { found, impacted } = analyzeImpact("./src/index.ts", "config");

if (found) {
  console.log(`影响 ${config} 的变量:`);
  for (const node of impacted) {
    console.log(`  - ${node.name}`);
  }
}
```

### 4. Tree-shaking 分析

#### 分析未使用代码
```typescript
import { analyzeTreeShaking, generateTreeShakingReport } from "./index";

// 从入口文件分析
const result = analyzeTreeShaking(["./src/index.ts"], {
  sideEffects: [
    "*.css",
    "*.scss", 
    /polyfill/,
    /side-effect/
  ]
});

// 查看统计
console.log(`死代码占比: ${result.stats.deadCodePercentage.toFixed(2)}%`);

// 查看未使用的导出
for (const [file, exports] of result.unusedExports) {
  console.log(`${file}:`);
  for (const exp of exports) {
    console.log(`  - ${exp} (未使用)`);
  }
}

// 查看死模块
for (const file of result.deadModules) {
  console.log(`死模块: ${file} (可以完全移除)`);
}

// 生成完整报告
const report = generateTreeShakingReport(result);
console.log(report);
```

#### Tree-shaking 分析结果结构
```typescript
interface TreeShakingResult {
  // 已使用的导出
  usedExports: Map<string, Set<string>>;
  // 未使用的导出（可删除）
  unusedExports: Map<string, Set<string>>;
  // 已使用的导入
  usedImports: Map<string, Set<string>>;
  // 未使用的导入（可删除）
  unusedImports: Map<string, Set<string>>;
  // 副作用模块（不能 tree-shaking）
  sideEffectModules: Set<string>;
  // 死代码（整个模块都未使用）
  deadModules: Set<string>;
  // 统计信息
  stats: {
    totalExports: number;
    usedExportsCount: number;
    deadCodePercentage: number;
  };
}
```

### 5. 底层 API（更灵活）

```typescript
import { 
  EntryAnalyzer, 
  VariableGraphBuilder,
  TreeShakingAnalyzer 
} from "./index";

// 分析入口
const analyzer = new EntryAnalyzer();
const { moduleGraph, contexts } = analyzer.analyze("./src/index.ts");

// 构建图谱
const graphBuilder = new VariableGraphBuilder(moduleGraph, contexts);
const graph = graphBuilder.build();

// 获取依赖子图
const subGraph = graphBuilder.getDependencySubgraph("./src/index.ts", 2);

// 获取调用链
const chain = graphBuilder.getCallChain(binding, filePath);

// 获取影响范围
const impacted = graphBuilder.getImpactedVariables(binding, filePath);

// 导出为 DOT 格式
const dot = graphBuilder.toDotFormat(graph);

// Tree-shaking 分析
const treeShaker = new TreeShakingAnalyzer(moduleGraph, contexts);
const result = treeShaker.analyze(["./src/index.ts"], {
  sideEffects: ["*.css", /polyfill/]
});
```

## VariableGraph 结构

```typescript
{
  nodes: [
    {
      id: "filePath::variableName",  // 唯一标识
      name: "variableName",          // 变量名
      module: "/absolute/path.ts",   // 所在模块
      kind: "function" | "const" | "let" | "var" | "param" | "import",
      binding: Binding               // 原始 Binding 对象
    }
  ],
  edges: [
    {
      from: "filePath::varA",
      to: "filePath::varB", 
      type: "dependency" | "call" | "import" | "export"
    }
  ],
  moduleNodes: Map<modulePath, VariableNode[]>
}
```

## 运行示例

### 基础分析
```bash
# 分析 src/index.ts
npx ts-node examples/analyze-entry.ts ./src/index.ts

# 分析特定函数的调用链
npx ts-node examples/analyze-entry.ts ./src/index.ts main
```

### Tree-shaking 分析
```bash
# 分析未使用代码
npx ts-node examples/tree-shaking.ts ./src/index.ts

# 分析整个项目
npx ts-node examples/tree-shaking.ts ./src/index.ts --project ./src
```

## 可视化

生成 DOT 格式文件后，使用 Graphviz 渲染：

```bash
# 生成 PNG 图片
dot -Tpng output/variable-graph.dot -o output/graph.png

# 生成 SVG
dot -Tsvg output/variable-graph.dot -o output/graph.svg
```

## 模块依赖图

ModuleLinker 可以生成模块级别的依赖图：

```typescript
import { ModuleLinker } from "./analyzer/passes/linking/moduleLinker";

const linker = new ModuleLinker(moduleGraph);
linker.link();

const { nodes, edges } = linker.getModuleDependencyGraph();
```
