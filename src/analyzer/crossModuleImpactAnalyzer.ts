import { Binding } from "./binding/Binding";
import { ModuleGraph } from "./graph/module/moduleGraph";
import { AnalyzerContext } from "./core/context";

/**
 * 跨模块影响分析结果
 */
export interface CrossModuleImpactResult {
  /** 直接受影响的 binding（同一模块内） */
  directImpacts: Binding[];
  /** 跨模块受影响的 binding（导入此变量的模块） */
  crossModuleImpacts: Map<string, Binding[]>;
  /** 影响传播链 */
  impactChains: Binding[][];
  /** 所有受影响的唯一 binding */
  allImpactedBindings: Set<Binding>;
}

/**
 * 跨模块影响分析器
 * 
 * 当模块 A 导出变量 n，模块 B 导入 n 时：
 * - A.n 和 B.n 通过 live binding 链接
 * - 当 A.n 变化时，B.n 也会变化
 * - 这种变化会继续传播到所有依赖 B.n 的地方
 */
export class CrossModuleImpactAnalyzer {
  constructor(
    private moduleGraph: ModuleGraph,
    private contexts: Map<string, AnalyzerContext>
  ) {}

  /**
   * 分析一个 binding 变化的影响范围
   * @param binding 变化的 binding
   * @param options 分析选项
   */
  analyze(
    binding: Binding,
    options: {
      /** 是否追踪跨模块 */
      followCrossModule?: boolean;
      /** 最大深度 */
      maxDepth?: number;
    } = {}
  ): CrossModuleImpactResult {
    const { followCrossModule = true, maxDepth = Infinity } = options;
    
    const visited = new Set<Binding>();
    const directImpacts: Binding[] = [];
    const crossModuleImpacts = new Map<string, Binding[]>();
    const impactChains: Binding[][] = [];

    // BFS 遍历影响链
    const queue: Array<{ binding: Binding; chain: Binding[]; depth: number }> = [
      { binding, chain: [binding], depth: 0 },
    ];

    while (queue.length > 0) {
      const { binding: current, chain, depth } = queue.shift()!;

      if (visited.has(current)) continue;
      if (depth > maxDepth) continue;
      
      visited.add(current);

      // 1. 分析同一模块内的依赖（通过 SymbolGraph）
      // 找到依赖 current 的所有 binding（即谁使用了 current）
      const dependentBindings = this.findBindingsThatDependOn(current);
      for (const depBinding of dependentBindings) {
        if (!visited.has(depBinding)) {
          directImpacts.push(depBinding);
          const newChain = [...chain, depBinding];
          impactChains.push(newChain);
          queue.push({ binding: depBinding, chain: newChain, depth: depth + 1 });
        }
      }

      // 2. 跨模块传播：如果当前 binding 被其他模块导入
      if (followCrossModule && current.importedBy.length > 0) {
        for (const importBinding of current.importedBy) {
          if (!visited.has(importBinding)) {
            const moduleId = importBinding.moduleId || "unknown";
            
            if (!crossModuleImpacts.has(moduleId)) {
              crossModuleImpacts.set(moduleId, []);
            }
            crossModuleImpacts.get(moduleId)!.push(importBinding);

            const newChain = [...chain, importBinding];
            impactChains.push(newChain);
            queue.push({ binding: importBinding, chain: newChain, depth: depth + 1 });
          }
        }
      }

      // 3. 如果当前是导入的 binding，追踪到源 binding
      if (followCrossModule && current.exportSource) {
        const sourceBinding = current.exportSource;
        if (!visited.has(sourceBinding)) {
          // 反向追踪：如果导入的变量变化，可能影响源模块的分析
          // 这里通常不需要，因为变化是从源开始的
        }
      }
    }

    return {
      directImpacts,
      crossModuleImpacts,
      impactChains,
      allImpactedBindings: visited,
    };
  }

  /**
   * 查找所有跨模块链接的 binding
   * 返回一个映射，显示哪些 binding 是跨模块链接的
   */
  findAllCrossModuleLinks(): Array<{
    source: Binding;
    sourceModule: string;
    target: Binding;
    targetModule: string;
    exportName: string;
  }> {
    const links: Array<{
      source: Binding;
      sourceModule: string;
      target: Binding;
      targetModule: string;
      exportName: string;
    }> = [];

    for (const [filePath, module] of this.moduleGraph.modules) {
      for (const binding of module.bindings) {
        // 如果 binding 有 exportSource，说明是导入的
        if (binding.exportSource && binding.moduleId) {
          links.push({
            source: binding.exportSource,
            sourceModule: binding.exportSource.moduleId || "unknown",
            target: binding,
            targetModule: binding.moduleId,
            exportName: binding.exportSource.name,
          });
        }
      }
    }

    return links;
  }

  /**
   * 获取实时绑定的详情
   */
  getLiveBindingInfo(binding: Binding): {
    isImported: boolean;
    isExported: boolean;
    sourceBinding?: Binding;
    sourceModule?: string;
    importedBy: Binding[];
    importedByModules: string[];
  } {
    const importedByModules = binding.importedBy
      .map((b) => b.moduleId)
      .filter((m): m is string => !!m);

    return {
      isImported: !!binding.exportSource,
      isExported: binding.importedBy.length > 0,
      sourceBinding: binding.exportSource,
      sourceModule: binding.exportSource?.moduleId,
      importedBy: binding.importedBy,
      importedByModules: [...new Set(importedByModules)],
    };
  }

  /**
   * 当源模块的变量变化时，获取所有受影响的模块
   */
  getImpactedModules(sourceModule: string, exportName: string): string[] {
    const module = this.moduleGraph.modules.get(sourceModule);
    if (!module) return [];

    const exportBinding = module.exports.get(exportName) || module.defaultExport;
    if (!exportBinding) return [];

    const impactedModules = new Set<string>();

    // 遍历所有导入此 binding 的模块
    for (const importBinding of exportBinding.importedBy) {
      if (importBinding.moduleId) {
        impactedModules.add(importBinding.moduleId);
      }
    }

    return [...impactedModules];
  }

  /**
   * 生成跨模块依赖图（用于可视化）
   */
  generateCrossModuleGraph(): {
    nodes: Array<{ id: string; module: string; name: string; kind: string }>;
    edges: Array<{ from: string; to: string; type: "live-binding" | "internal" }>;
  } {
    const nodes: Array<{ id: string; module: string; name: string; kind: string }> = [];
    const edges: Array<{ from: string; to: string; type: "live-binding" | "internal" }> = [];
    const nodeIds = new Set<string>();

    const getNodeId = (binding: Binding) => `${binding.moduleId}::${binding.name}`;

    for (const [filePath, module] of this.moduleGraph.modules) {
      for (const binding of module.bindings) {
        const nodeId = getNodeId(binding);
        if (!nodeIds.has(nodeId)) {
          nodes.push({
            id: nodeId,
            module: filePath,
            name: binding.name,
            kind: binding.kind,
          });
          nodeIds.add(nodeId);
        }

        // 添加跨模块链接边
        if (binding.exportSource) {
          const sourceId = getNodeId(binding.exportSource);
          edges.push({
            from: sourceId,
            to: nodeId,
            type: "live-binding",
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * 打印跨模块链接报告
   */
  printCrossModuleLinks(): string {
    const lines: string[] = [];
    
    lines.push("=".repeat(60));
    lines.push("跨模块实时绑定 (Live Binding) 报告");
    lines.push("=".repeat(60));

    const links = this.findAllCrossModuleLinks();

    if (links.length === 0) {
      lines.push("\n未发现跨模块绑定\n");
      return lines.join("\n");
    }

    // 按源模块分组
    const bySourceModule = new Map<string, typeof links>();
    for (const link of links) {
      if (!bySourceModule.has(link.sourceModule)) {
        bySourceModule.set(link.sourceModule, []);
      }
      bySourceModule.get(link.sourceModule)!.push(link);
    }

    for (const [sourceModule, moduleLinks] of bySourceModule) {
      lines.push(`\n📦 源模块: ${sourceModule}`);
      lines.push("-".repeat(40));

      // 按导出变量分组
      const byExport = new Map<string, typeof links>();
      for (const link of moduleLinks) {
        if (!byExport.has(link.exportName)) {
          byExport.set(link.exportName, []);
        }
        byExport.get(link.exportName)!.push(link);
      }

      for (const [exportName, exportLinks] of byExport) {
        lines.push(`\n  📤 导出: ${exportName}`);
        lines.push(`     被导入到:`);
        for (const link of exportLinks) {
          lines.push(`       - ${link.targetModule} (as ${link.target.name})`);
        }
      }
    }

    lines.push("\n" + "=".repeat(60));
    return lines.join("\n");
  }

  /**
   * 查找所有依赖指定 binding 的其他 binding
   * 使用 SymbolGraph 的反向边：谁引用了这个 binding
   */
  private findBindingsThatDependOn(binding: Binding): Binding[] {
    const result: Binding[] = [];
    
    // 遍历所有上下文，查找 SymbolGraph 中的反向依赖
    for (const [filePath, ctx] of this.contexts) {
      // 检查 reverseEdges：谁依赖了 binding
      for (const edge of ctx.symbolGraph.reverseEdges) {
        // reverseEdge: to -> from，表示 to 被 from 依赖
        // 我们要找的是：谁依赖了 binding，即 from === binding 的边
        if (edge.from === binding) {
          // edge.to 依赖于 edge.from (即 binding)
          if (!result.includes(edge.to)) {
            result.push(edge.to);
          }
        }
      }
    }
    
    return result;
  }
}
