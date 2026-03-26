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

### 4. 跨模块影响分析 (Live Binding)

ES 模块的导入导出是实时绑定（Live Binding）。当 `a.js` 导出 `n`，`b.js` 导入 `n` 时：
- `a.n` 和 `b.n` 是同一个绑定的不同视图
- 当 `a.n` 变化时，`b.n` 会自动反映这个变化
- 这种变化会继续传播到所有依赖 `b.n` 的地方

#### 分析跨模块影响
```typescript
import { 
  analyzeCrossModuleImpact, 
  printCrossModuleLinks,
  CrossModuleImpactAnalyzer 
} from "./index";

// 打印所有跨模块实时绑定
printCrossModuleLinks("./src/index.ts");

// 分析特定变量的跨模块影响
const { found, result, liveBindingInfo } = analyzeCrossModuleImpact(
  "./src/index.ts",
  "n"  // 变量名，或 "./src/a.js::n" 格式
);

if (found) {
  // 查看实时绑定信息
  console.log("是导入的:", liveBindingInfo?.isImported);
  console.log("是导出的:", liveBindingInfo?.isExported);
  console.log("源模块:", liveBindingInfo?.sourceModule);
  console.log("影响模块:", liveBindingInfo?.importedByModules);
  
  // 查看影响分析结果
  console.log("直接影响:", result?.directImpacts.length);
  console.log("跨模块影响:", result?.crossModuleImpacts.size);
  console.log("影响链:", result?.impactChains);
}

// 使用底层 API
const analyzer = new EntryAnalyzer();
const { moduleGraph } = analyzer.analyze("./src/index.ts");

// 链接模块（建立 import/export 关系）
const linker = new ModuleLinker(moduleGraph);
linker.link();

// 创建跨模块影响分析器
const impactAnalyzer = new CrossModuleImpactAnalyzer(moduleGraph);

// 查找所有跨模块链接
const links = impactAnalyzer.findAllCrossModuleLinks();
for (const link of links) {
  console.log(`${link.exportName}: ${link.sourceModule} -> ${link.targetModule}`);
}

// 获取实时绑定信息
const binding = /* 获取某个 binding */;
const info = impactAnalyzer.getLiveBindingInfo(binding);
console.log("被导入到:", info.importedByModules);

// 分析变化影响
const impact = impactAnalyzer.analyze(binding);
console.log("受影响的 binding:", impact.allImpactedBindings);
```

#### Binding 的跨模块属性
```typescript
interface Binding {
  // ... 其他属性
  
  /** 导出源 binding（用于 import 的实时绑定） */
  exportSource?: Binding;
  
  /** 被哪些 binding 导入（反向链接） */
  importedBy: Binding[];
  
  /** 所在模块路径 */
  moduleId?: string;
}
```

### 5. Tree-shaking 分析

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

### 5. Chunk Graph 分析（代码分割）

分析代码分割、异步加载、chunk 依赖关系。

```typescript
import { 
  analyzeChunkGraph, 
  generateChunkGraphReport,
  ChunkGraphBuilder 
} from "./index";

// 分析 Chunk Graph
const chunkGraph = analyzeChunkGraph(
  { main: "./src/index.ts" },
  moduleGraph
);

// 查看 chunks
for (const [chunkId, chunk] of chunkGraph.chunks) {
  console.log(`${chunk.name} (${chunk.type}):`);
  console.log(`  模块数: ${chunk.modules.size}`);
  console.log(`  大小: ${chunk.size} bytes`);
  console.log(`  父 chunks: ${Array.from(chunk.parents)}`);
  console.log(`  异步依赖: ${Array.from(chunk.asyncDeps)}`);
}

// 查看 chunk 依赖
for (const edge of chunkGraph.edges) {
  console.log(`${edge.from} ${edge.type === "dynamic" ? "~>" : "->"} ${edge.to}`);
}

// 生成报告
const report = generateChunkGraphReport(chunkGraph);
console.log(report);

// 使用底层 API 自定义配置
const builder = new ChunkGraphBuilder(moduleGraph, {
  entries: { main: "./src/index.ts", admin: "./src/admin.ts" },
  splitChunks: {
    minSize: 30000,        // 30KB
    minChunks: 2,          // 至少被 2 个 chunk 引用
    maxAsyncRequests: 5,   // 最大异步请求数
    vendors: /node_modules/, // 提取 vendors
    cacheGroups: [
      {
        name: "shared",
        test: /shared/,      // 匹配 shared 目录下的模块
        priority: 10,
      },
      {
        name: "all-common",  // 不写 test，默认匹配所有模块
        minChunks: 3,        // 被至少 3 个 chunk 引用
        priority: 5,
      },
    ],
  },
});

const graph = builder.build();
```

#### 缓存组 (cacheGroups) 说明

**test 属性（可选）**
- 用于匹配哪些模块应该被分到该缓存组
- 如果不填，默认匹配**所有模块**（相当于 `test: /.*/`）
- 通常配合 `minChunks` 使用，提取被多次引用的公共模块

```typescript
cacheGroups: [
  // 1. 匹配特定目录
  {
    name: "shared",
    test: /shared/,        // 只匹配路径中包含 "shared" 的模块
    priority: 10,
  },
  // 2. 匹配 vendors
  {
    name: "vendors",
    test: /node_modules/,  // 只匹配 node_modules 中的模块
    priority: 20,
  },
  // 3. 不写 test - 匹配所有模块
  {
    name: "common",
    // test 不填，默认匹配所有模块
    minChunks: 2,          // 被至少 2 个 chunk 引用才会提取
    priority: 5,
  },
]
```

**优先级 (priority)**
- 数值越大，优先级越高
- 一个模块可能匹配多个缓存组，会被分到优先级最高的组

#### Chunk Graph 结构
```typescript
interface ChunkGraph {
  chunks: Map<string, Chunk>;
  edges: ChunkEdge[];
  entryChunks: Set<string>;
  moduleToChunk: Map<string, string>;
}

interface Chunk {
  id: string;
  name: string;
  type: "entry" | "async" | "common" | "vendor";
  modules: Map<string, ChunkModule>;
  size: number;
  parents: Set<string>;     // 父 chunks
  children: Set<string>;    // 子 chunks
  asyncDeps: Set<string>;   // 异步依赖
}
```

### 6. 底层 API（更灵活）

```typescript
import { 
  EntryAnalyzer, 
  VariableGraphBuilder,
  TreeShakingAnalyzer,
  ChunkGraphBuilder,
  CrossModuleImpactAnalyzer,
  ModuleLinker
} from "./index";

// 分析入口
const analyzer = new EntryAnalyzer();
const { moduleGraph, contexts } = analyzer.analyze("./src/index.ts");

// 链接模块（建立 import/export 关系）
const linker = new ModuleLinker(moduleGraph);
linker.link();

// 构建变量图谱
const graphBuilder = new VariableGraphBuilder(moduleGraph, contexts);
const graph = graphBuilder.build();

// 跨模块影响分析
const impactAnalyzer = new CrossModuleImpactAnalyzer(moduleGraph, contexts);
const impact = impactAnalyzer.analyze(binding);

// Chunk Graph 分析
const chunkBuilder = new ChunkGraphBuilder(moduleGraph, { entries });
const chunkGraph = chunkBuilder.build();

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

### Chunk Graph 分析
```bash
# 分析代码分割
npx ts-node examples/chunk-graph.ts ./src/index.ts

# 输出包含 chunk 依赖图、代码分割建议、可视化 DOT 文件
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
