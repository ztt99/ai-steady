import { EntryAnalyzer } from "./analyzer/entryAnalyzer";
import { VariableGraphBuilder, VariableGraph } from "./analyzer/variableGraphBuilder";
import { ModuleGraph } from "./analyzer/graph/module/moduleGraph";
import { DependencyGraphBuilder } from "./analyzer/graphDep";
import { getAllTSFiles } from "./scanner/fileScanner";
import { ProjectReport } from "./types/report";
import { TreeShakingAnalyzer, TreeShakingResult } from "./analyzer/treeShakingAnalyzer";

export { EntryAnalyzer } from "./analyzer/entryAnalyzer";
export { VariableGraphBuilder, VariableGraph } from "./analyzer/variableGraphBuilder";
export { ModuleGraph } from "./analyzer/graph/module/moduleGraph";
export { DependencyGraphBuilder } from "./analyzer/graphDep";
export { TreeShakingAnalyzer, TreeShakingResult } from "./analyzer/treeShakingAnalyzer";

/**
 * 分析入口文件并生成变量图谱
 * @param entryFile 入口文件路径
 * @returns 变量图谱和分析结果
 */
export function analyzeEntry(entryFile: string): {
  graph: VariableGraph;
  moduleGraph: ModuleGraph;
  toDot: () => string;
} {
  // 1. 分析入口文件及所有依赖
  const analyzer = new EntryAnalyzer();
  const { moduleGraph, contexts } = analyzer.analyze(entryFile);

  // 2. 构建变量图谱
  const graphBuilder = new VariableGraphBuilder(moduleGraph, contexts);
  const graph = graphBuilder.build();

  return {
    graph,
    moduleGraph,
    toDot: () => graphBuilder.toDotFormat(graph),
  };
}

/**
 * 分析整个项目（所有文件）
 * @param rootDir 项目根目录
 * @returns 项目报告
 */
export function analyzeProject(rootDir?: string): ProjectReport {
  const files = getAllTSFiles(rootDir);

  let totalFunctions = 0;
  let totalVariables = 0;
  let totalImports = 0;
  const filesWithConsole: string[] = [];

  // 分析所有文件并构建模块图
  const { analyzeFile } = require("./analyzer/core/analyzer");
  const moduleGraph = new ModuleGraph();

  for (const file of files) {
    const report = analyzeFile(file, moduleGraph);
    totalFunctions += report.functionCount || 0;
    totalVariables += report.variableCount || 0;
    totalImports += report.importCount || 0;

    if (report.hasConsoleLog) {
      filesWithConsole.push(file);
    }
  }

  // 构建依赖图
  const depGraph = new DependencyGraphBuilder(moduleGraph);
  const dependencyGraph = depGraph.build();

  return {
    totalFiles: files.length,
    totalFunctions,
    totalVariables,
    totalImports,
    filesWithConsole,
  };
}

/**
 * 分析入口文件并获取调用链路
 * @param entryFile 入口文件
 * @param targetFunction 目标函数名
 */
export function analyzeCallChain(entryFile: string, targetFunction: string) {
  const { graph, moduleGraph } = analyzeEntry(entryFile);
  
  // 查找目标函数的节点
  const targetNode = graph.nodes.find(
    n => n.name === targetFunction && n.kind === "function"
  );

  if (!targetNode) {
    return { found: false, chain: [] as VariableGraph["nodes"] };
  }

  // 构建调用链
  const visited = new Set<string>();
  const chain: VariableGraph["nodes"] = [];

  const buildChain = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = graph.nodes.find(n => n.id === nodeId);
    if (node) {
      chain.push(node);
    }

    // 查找调用边
    for (const edge of graph.edges) {
      if (edge.from === nodeId && edge.type === "call") {
        buildChain(edge.to);
      }
    }
  };

  buildChain(targetNode.id);

  return { found: true, chain };
}

/**
 * 分析变量影响范围
 * @param entryFile 入口文件
 * @param variableName 变量名
 */
export function analyzeImpact(entryFile: string, variableName: string) {
  const { graph } = analyzeEntry(entryFile);

  // 查找目标变量
  const targetNode = graph.nodes.find(n => n.name === variableName);
  if (!targetNode) {
    return { found: false, impacted: [] as VariableGraph["nodes"] };
  }

  // 查找影响该变量的所有变量
  const visited = new Set<string>();
  const impacted: VariableGraph["nodes"] = [];

  const findImpact = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    for (const edge of graph.edges) {
      if (edge.to === nodeId && (edge.type === "dependency" || edge.type === "import")) {
        const node = graph.nodes.find(n => n.id === edge.from);
        if (node) {
          impacted.push(node);
          findImpact(edge.from);
        }
      }
    }
  };

  findImpact(targetNode.id);

  return { found: true, impacted };
}

/**
 * 分析 tree-shaking，识别未使用的代码
 * @param entryFiles 入口文件列表
 * @param rootDir 项目根目录（可选，用于分析整个项目）
 * @param options tree-shaking 配置
 * @returns Tree-shaking 分析结果
 */
export function analyzeTreeShaking(
  entryFiles: string[],
  options: {
    rootDir?: string;
    sideEffects?: (string | RegExp)[];
  } = {}
): TreeShakingResult {
  const moduleGraph = new ModuleGraph();
  const contexts = new Map();

  // 分析所有文件或从入口开始
  if (options.rootDir) {
    const files = getAllTSFiles(options.rootDir);
    const { analyzeFile } = require("./analyzer/core/analyzer");
    for (const file of files) {
      const ctx = analyzeFile(file, moduleGraph);
      contexts.set(file, ctx);
    }
  } else {
    // 从入口递归分析
    const analyzer = new EntryAnalyzer();
    const result = analyzer.analyze(entryFiles[0]);
    contexts.set(entryFiles[0], result.contexts.get(entryFiles[0]));
  }

  // 执行 tree-shaking 分析
  const treeShaker = new TreeShakingAnalyzer(moduleGraph, contexts);
  return treeShaker.analyze(entryFiles, {
    sideEffects: options.sideEffects,
  });
}

/**
 * 生成 tree-shaking 报告
 * @param result TreeShakingResult
 * @returns 格式化的报告字符串
 */
export function generateTreeShakingReport(result: TreeShakingResult): string {
  const analyzer = new TreeShakingAnalyzer(new ModuleGraph(), new Map());
  return analyzer.generateReport(result);
}
