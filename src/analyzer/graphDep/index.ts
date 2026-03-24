import { ModuleGraph } from "../graph/module/moduleGraph";

interface GraphNode {
  id: string; // 文件路径
  type: "module";
}

interface GraphEdge {
  from: string;
  to: string;
  type: "import" | "reExport" | "export";
}

interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export class DependencyGraphBuilder {
  constructor(private modelGraph: ModuleGraph) {}

  build() {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    const visited = new Set<string>();
    const visitedEdges = new Set<string>();

    for (const [file, module] of this.modelGraph.modules) {
      if (!visited.has(file)) {
        nodes.push({
          id: file,
          type: "module",
        });
        visited.add(file);
      }

      for (const [, imp] of module.imports) {
        if (visitedEdges.has(`${file}->${imp.source}`)) continue;
        edges.push({
          from: file, //从这个文件
          to: imp.source, // 找到这个文件
          type: "import", // 操作的类型是 import 导入
        });
        visitedEdges.add(`${file}->${imp.source}`);
      }

      for (const reExport of module.reExports) {
        if (visitedEdges.has(`${file}->${reExport.source}`)) continue;
        // export * from '...'
        edges.push({
          from: file, //从这个文件
          to: reExport.source, // 找到这个文件
          type: "reExport",
        });
        visitedEdges.add(`${file}->${reExport.source}`);
      }
    }
    return { nodes, edges };
  }
}
