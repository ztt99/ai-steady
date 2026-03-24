import { Binding } from "./binding/Binding";
import { ModuleGraph } from "./graph/module/moduleGraph";
import { SymbolGraph } from "./graph/symbol/symbolGraph";
import { AnalyzerContext } from "./core/context";

/**
 * 变量节点
 */
export interface VariableNode {
  /** 变量唯一标识 */
  id: string;
  /** 变量名 */
  name: string;
  /** 所在模块 */
  module: string;
  /** 变量类型 */
  kind: import("./binding/Binding").Binding["kind"];
  /** 绑定的 Binding 对象 */
  binding: Binding;
}

/**
 * 变量边类型
 */
export type VariableEdgeType = 
  | import("./graph/symbol/symbolEdge").EdgeType
  | "import"
  | "export"
  | "param"
  | "return";

/**
 * 变量边
 */
export interface VariableEdge {
  from: string;
  to: string;
  type: VariableEdgeType;
  /** 附加数据 */
  meta?: Record<string, any>;
}

/**
 * 变量图谱
 */
export interface VariableGraph {
  nodes: VariableNode[];
  edges: VariableEdge[];
  /** 按模块分组的节点 */
  moduleNodes: Map<string, VariableNode[]>;
}

/**
 * 变量图谱构建器
 * 构建跨模块的完整变量依赖图
 */
export class VariableGraphBuilder {
  private nodes = new Map<string, VariableNode>();
  private edges: VariableEdge[] = [];
  private moduleNodes = new Map<string, VariableNode[]>();

  constructor(
    private moduleGraph: ModuleGraph,
    private contexts: Map<string, AnalyzerContext>
  ) {}

  /**
   * 构建完整的变量图谱
   */
  build(): VariableGraph {
    this.nodes.clear();
    this.edges = [];
    this.moduleNodes.clear();

    // 1. 收集所有模块的变量节点
    for (const [filePath, module] of this.moduleGraph.modules) {
      const ctx = this.contexts.get(filePath);
      if (!ctx) continue;

      const moduleVars: VariableNode[] = [];

      // 收集模块内所有 binding
      for (const binding of module.bindings) {
        const nodeId = this.getNodeId(filePath, binding.name);
        const node: VariableNode = {
          id: nodeId,
          name: binding.name,
          module: filePath,
          kind: binding.kind,
          binding,
        };
        this.nodes.set(nodeId, node);
        moduleVars.push(node);
      }

      this.moduleNodes.set(filePath, moduleVars);
    }

    // 2. 构建模块内的依赖边（从 SymbolGraph）
    for (const [filePath, ctx] of this.contexts) {
      this.buildInternalEdges(filePath, ctx);
    }

    // 3. 构建跨模块的导入/导出边
    this.buildCrossModuleEdges();

    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      moduleNodes: this.moduleNodes,
    };
  }

  /**
   * 构建模块内部的依赖边
   */
  private buildInternalEdges(filePath: string, ctx: AnalyzerContext): void {
    // 从 SymbolGraph 获取依赖关系
    for (const edge of ctx.symbolGraph.edges) {
      const fromId = this.getNodeId(filePath, edge.from.name);
      const toId = this.getNodeId(filePath, edge.to.name);

      // 确保节点存在
      if (this.nodes.has(fromId) && this.nodes.has(toId)) {
        this.edges.push({
          from: fromId,
          to: toId,
          type: edge.type,
        });
      }
    }
  }

  /**
   * 构建跨模块的导入导出边
   */
  private buildCrossModuleEdges(): void {
    for (const [filePath, module] of this.moduleGraph.modules) {
      // 处理导入关系
      for (const [localName, importInfo] of module.imports) {
        const fromId = this.getNodeId(filePath, localName);
        
        // 解析源模块路径
        const sourceModule = this.resolveModulePath(importInfo.source, filePath);
        if (!sourceModule) continue;

        // 找到源模块中导出的 binding
        const sourceMod = this.moduleGraph.modules.get(sourceModule);
        if (!sourceMod) continue;

        // 确定导出的名称
        const exportedName = importInfo.importedName === "*" 
          ? localName 
          : importInfo.importedName;

        const toId = this.getNodeId(sourceModule, exportedName);

        // 检查节点是否存在
        if (this.nodes.has(fromId) && this.nodes.has(toId)) {
          this.edges.push({
            from: fromId,
            to: toId,
            type: "import",
            meta: {
              importedName: importInfo.importedName,
              source: importInfo.source,
            },
          });
        }
      }

      // 处理导出关系
      for (const [exportName, binding] of module.exports) {
        const exportId = this.getNodeId(filePath, exportName);
        
        // 找到原始的 binding
        if (module.bindings.has(binding)) {
          const originalId = this.getNodeId(filePath, binding.name);
          if (originalId !== exportId && this.nodes.has(originalId)) {
            this.edges.push({
              from: exportId,
              to: originalId,
              type: "export",
              meta: {
                exportName,
                originalName: binding.name,
              },
            });
          }
        }
      }
    }
  }

  /**
   * 获取入口文件的依赖子图
   * @param entryFile 入口文件
   * @param depth 递归深度（默认无限）
   */
  getDependencySubgraph(entryFile: string, depth: number = Infinity): VariableGraph {
    const visited = new Set<string>();
    const queue: Array<{ file: string; depth: number }> = [{ file: entryFile, depth: 0 }];
    
    while (queue.length > 0) {
      const { file, depth: currentDepth } = queue.shift()!;
      
      if (visited.has(file) || currentDepth > depth) continue;
      visited.add(file);

      const module = this.moduleGraph.modules.get(file);
      if (!module) continue;

      for (const dep of module.dependencies) {
        const resolved = this.resolveModulePath(dep, file);
        if (resolved && !visited.has(resolved)) {
          queue.push({ file: resolved, depth: currentDepth + 1 });
        }
      }
    }

    // 过滤图谱
    const nodes = Array.from(this.nodes.values()).filter(
      n => visited.has(n.module)
    );
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = this.edges.filter(
      e => nodeIds.has(e.from) && nodeIds.has(e.to)
    );

    return {
      nodes,
      edges,
      moduleNodes: this.filterModuleNodes(visited),
    };
  }

  /**
   * 获取变量的调用链路
   */
  getCallChain(binding: Binding, filePath: string): VariableNode[] {
    const startId = this.getNodeId(filePath, binding.name);
    const visited = new Set<string>();
    const chain: VariableNode[] = [];

    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        chain.push(node);
      }

      // 查找调用边
      for (const edge of this.edges) {
        if (edge.from === nodeId && edge.type === "call") {
          dfs(edge.to);
        }
      }
    };

    dfs(startId);
    return chain;
  }

  /**
   * 查找影响某个变量的所有变量
   */
  getImpactedVariables(binding: Binding, filePath: string): VariableNode[] {
    const targetId = this.getNodeId(filePath, binding.name);
    const visited = new Set<string>();
    const result: VariableNode[] = [];

    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // 查找反向依赖
      for (const edge of this.edges) {
        if (edge.to === nodeId && (edge.type === "dependency" || edge.type === "param")) {
          const fromNode = this.nodes.get(edge.from);
          if (fromNode) {
            result.push(fromNode);
            dfs(edge.from);
          }
        }
      }
    };

    dfs(targetId);
    return result;
  }

  /**
   * 打印图谱（调试用）
   */
  print(graph?: VariableGraph): void {
    const g = graph || this.build();
    
    console.log("=== Variable Graph ===");
    console.log(`Nodes: ${g.nodes.length}`);
    console.log(`Edges: ${g.edges.length}`);
    
    console.log("\nNodes:");
    for (const node of g.nodes) {
      console.log(`  [${node.kind}] ${node.name} (${node.module})`);
    }
    
    console.log("\nEdges:");
    for (const edge of g.edges) {
      const from = this.nodes.get(edge.from);
      const to = this.nodes.get(edge.to);
      console.log(`  ${edge.type}: ${from?.name} -> ${to?.name}`);
    }
  }

  /**
   * 生成 DOT 格式（用于可视化）
   */
  toDotFormat(graph?: VariableGraph): string {
    const g = graph || this.build();
    
    let dot = "digraph VariableGraph {\n";
    dot += "  rankdir=TB;\n";
    dot += "  node [shape=box];\n\n";

    // 节点
    for (const node of g.nodes) {
      const color = this.getNodeColor(node.kind);
      dot += `  "${node.id}" [label="${node.name}", fillcolor="${color}", style=filled];\n`;
    }

    dot += "\n";

    // 边
    for (const edge of g.edges) {
      const style = edge.type === "import" ? "dashed" : "solid";
      dot += `  "${edge.from}" -> "${edge.to}" [label="${edge.type}", style=${style}];\n`;
    }

    dot += "}\n";
    return dot;
  }

  /**
   * 获取节点ID
   */
  private getNodeId(filePath: string, name: string): string {
    return `${filePath}::${name}`;
  }

  /**
   * 解析模块路径
   */
  private resolveModulePath(importPath: string, fromFile: string): string | null {
    // 简单实现，实际需要更完整的模块解析
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
      return null;
    }

    const path = require("path");
    const baseDir = path.dirname(fromFile);
    const resolved = path.resolve(baseDir, importPath);
    return resolved;
  }

  /**
   * 过滤模块节点
   */
  private filterModuleNodes(visited: Set<string>): Map<string, VariableNode[]> {
    const result = new Map<string, VariableNode[]>();
    for (const [file, nodes] of this.moduleNodes) {
      if (visited.has(file)) {
        result.set(file, nodes);
      }
    }
    return result;
  }

  /**
   * 获取节点颜色
   */
  private getNodeColor(kind: VariableNode["kind"]): string {
    const colors: Record<string, string> = {
      var: "#ffcc99",
      let: "#ffcc99",
      const: "#ffcc99",
      function: "#99ccff",
      param: "#ccffcc",
      import: "#ffcccc",
      class: "#ffffcc",
    };
    return colors[kind] || "#ffffff";
  }
}
