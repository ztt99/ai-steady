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

### 3. 便捷 API

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

## 运行示例

```bash
# 分析 src/index.ts
npx ts-node examples/analyze-entry.ts ./src/index.ts

# 分析特定函数的调用链
npx ts-node examples/analyze-entry.ts ./src/index.ts main
```

## Graph 结构

### VariableNode（变量节点）
```typescript
interface VariableNode {
  id: string;           // 唯一标识: "filePath::variableName"
  name: string;         // 变量名
  module: string;       // 所在模块路径
  kind: "var" | "let" | "const" | "function" | "param" | "import" | "class";
  binding: Binding;     // 绑定的 Binding 对象
}
```

### VariableEdge（变量边）
```typescript
interface VariableEdge {
  from: string;         // 源节点 ID
  to: string;           // 目标节点 ID
  type: "dependency" | "call" | "import" | "export" | "param" | "return";
  meta?: Record<string, any>;
}
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
