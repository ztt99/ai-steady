import { Binding } from "./binding/Binding";
import { ModuleGraph } from "./graph/module/moduleGraph";
import { Module } from "./graph/module/module";
import { AnalyzerContext } from "./core/context";

/**
 * Tree-shaking 分析结果
 */
export interface TreeShakingResult {
  /** 已使用的导出（被其他模块使用） */
  usedExports: Map<string, Set<string>>;
  /** 未使用的导出（可删除） */
  unusedExports: Map<string, Set<string>>;
  /** 已使用的导入 */
  usedImports: Map<string, Set<string>>;
  /** 未使用的导入（可删除） */
  unusedImports: Map<string, Set<string>>;
  /** 副作用模块（不能被 tree-shaking） */
  sideEffectModules: Set<string>;
  /** 死代码（整个模块都未被使用） */
  deadModules: Set<string>;
  /** 可安全删除的代码统计 */
  stats: {
    totalExports: number;
    usedExportsCount: number;
    deadCodePercentage: number;
  };
}

/**
 * Tree-shaking 分析器
 * 基于入口文件分析，标记所有可达代码
 */
export class TreeShakingAnalyzer {
  /** 已访问的模块 */
  private visitedModules = new Set<string>();
  /** 已使用的导出 */
  private usedExports = new Map<string, Set<string>>();
  /** 已使用的导入 */
  private usedImports = new Map<string, Set<string>>();
  /** 副作用模块 */
  private sideEffectModules = new Set<string>();

  constructor(
    private moduleGraph: ModuleGraph,
    private contexts: Map<string, AnalyzerContext>,
  ) {}

  /**
   * 分析 tree-shaking
   * @param entryFiles 入口文件列表
   * @param options 配置选项
   */
  analyze(
    entryFiles: string[],
    options: {
      /** 副作用模块模式 */
      sideEffects?: (string | RegExp)[];
      /** 是否保留所有导出 */
      preserveExports?: string[];
    } = {},
  ): TreeShakingResult {
    this.visitedModules.clear();
    this.usedExports.clear();
    this.usedImports.clear();
    this.sideEffectModules.clear();

    // 1. 标记副作用模块
    this.markSideEffectModules(options.sideEffects || []);

    // 2. 从入口开始遍历，标记使用的导出
    for (const entry of entryFiles) {
      const absoluteEntry = this.resolvePath(entry);
      this.traverseFromEntry(absoluteEntry);
    }

    // 3. 计算未使用的导出
    const unusedExports = this.calculateUnusedExports();

    // 4. 计算未使用的导入
    const unusedImports = this.calculateUnusedImports();

    // 5. 识别死模块
    const deadModules = this.identifyDeadModules();

    // 6. 统计
    const stats = this.calculateStats();

    return {
      usedExports: this.usedExports,
      unusedExports,
      usedImports: this.usedImports,
      unusedImports,
      sideEffectModules: this.sideEffectModules,
      deadModules,
      stats,
    };
  }

  /**
   * 从入口开始遍历模块依赖图
   */
  private traverseFromEntry(entryFile: string): void {
    const queue: Array<{ file: string; importedName?: string }> = [{ file: entryFile }];

    while (queue.length > 0) {
      const { file, importedName } = queue.shift()!;

      if (this.visitedModules.has(file)) {
        // 如果模块已访问，但指定了具体导入，需要额外处理
        if (importedName) {
          this.markExportAsUsed(file, importedName);
        }
        continue;
      }

      this.visitedModules.add(file);

      const module = this.moduleGraph.modules.get(file);
      if (!module) continue;

      // 如果是副作用模块，标记所有导入为已使用
      if (this.sideEffectModules.has(file)) {
        this.markAllImportsAsUsed(module, file);
      }

      // 处理模块的导入
      for (const [localName, importInfo] of module.imports) {
        const sourceModule = this.resolveModulePath(importInfo.source, file);
        if (!sourceModule) continue;

        // 标记导入为已使用
        this.markImportAsUsed(file, localName);

        // 标记源模块的导出为已使用
        this.markExportAsUsed(sourceModule, importInfo.importedName);

        // 递归处理源模块
        if (!this.visitedModules.has(sourceModule)) {
          queue.push({
            file: sourceModule,
            importedName: importInfo.importedName,
          });
        }
      }

      // 处理重新导出
      for (const reExport of module.reExports) {
        const sourceModule = this.resolveModulePath(reExport.source, file);
        if (!sourceModule) continue;

        // 如果是 export * from，标记所有导出为已使用
        if (!reExport.exportClause) {
          this.markAllExportsAsUsed(sourceModule);
        } else {
          // 处理具名重新导出
          if (
            "elements" in reExport.exportClause &&
            Array.isArray(reExport.exportClause.elements)
          ) {
            for (const element of reExport.exportClause.elements) {
              const exportName = element.propertyName?.text || element.name.text;
              this.markExportAsUsed(sourceModule, exportName);
            }
          }
        }

        if (!this.visitedModules.has(sourceModule)) {
          queue.push({ file: sourceModule });
        }
      }

      // 分析模块内的引用关系，标记内部使用的导出
      this.analyzeInternalReferences(file, module);
    }
  }

  /**
   * 分析模块内部的引用关系
   */
  private analyzeInternalReferences(file: string, module: Module): void {
    const ctx = this.contexts.get(file);
    if (!ctx) return;

    // 从 SymbolGraph 分析依赖
    for (const edge of ctx.symbolGraph.edges) {
      const fromBinding = edge.from;
      const toBinding = edge.to;

      // 如果目标 binding 是导入的，标记为已使用
      for (const [localName, importInfo] of module.imports) {
        const importBinding = this.findBindingInModule(file, localName);
        if (importBinding === toBinding) {
          this.markImportAsUsed(file, localName);

          // 同时标记源模块的导出
          const sourceModule = this.resolveModulePath(importInfo.source, file);
          if (sourceModule) {
            this.markExportAsUsed(sourceModule, importInfo.importedName);
          }
        }
      }
    }
  }

  /**
   * 标记导出为已使用
   */
  private markExportAsUsed(file: string, exportName: string): void {
    if (!this.usedExports.has(file)) {
      this.usedExports.set(file, new Set());
    }
    this.usedExports.get(file)!.add(exportName);
  }

  /**
   * 标记导入为已使用
   */
  private markImportAsUsed(file: string, localName: string): void {
    if (!this.usedImports.has(file)) {
      this.usedImports.set(file, new Set());
    }
    this.usedImports.get(file)!.add(localName);
  }

  /**
   * 标记所有导出为已使用
   */
  private markAllExportsAsUsed(file: string): void {
    const module = this.moduleGraph.modules.get(file);
    if (!module) return;

    for (const exportName of module.exports.keys()) {
      this.markExportAsUsed(file, exportName);
    }

    if (module.defaultExport) {
      this.markExportAsUsed(file, "default");
    }
  }

  /**
   * 标记所有导入为已使用
   */
  private markAllImportsAsUsed(module: Module, file: string): void {
    for (const localName of module.imports.keys()) {
      this.markImportAsUsed(file, localName);
    }
  }

  /**
   * 标记副作用模块
   */
  private markSideEffectModules(patterns: (string | RegExp)[]): void {
    for (const [filePath, module] of this.moduleGraph.modules) {
      // 检查是否匹配副作用模式
      for (const pattern of patterns) {
        if (typeof pattern === "string") {
          if (filePath.includes(pattern)) {
            this.sideEffectModules.add(filePath);
            break;
          }
        } else if (pattern instanceof RegExp) {
          if (pattern.test(filePath)) {
            this.sideEffectModules.add(filePath);
            break;
          }
        }
      }

      // 检查是否有纯副作用导入（import './module'）
      // 这种导入只有副作用，没有绑定
      const hasSideEffectImport = Array.from(module.dependencies).some((dep) => {
        // 如果依赖存在但没有对应的导入绑定，说明是纯副作用导入
        return !Array.from(module.imports.values()).some((imp) => imp.source === dep);
      });

      if (hasSideEffectImport) {
        this.sideEffectModules.add(filePath);
      }
    }
  }

  /**
   * 计算未使用的导出
   */
  private calculateUnusedExports(): Map<string, Set<string>> {
    const unused = new Map<string, Set<string>>();

    for (const [file, module] of this.moduleGraph.modules) {
      const used = this.usedExports.get(file) || new Set();
      const moduleUnused = new Set<string>();

      // 检查命名导出
      for (const exportName of module.exports.keys()) {
        if (!used.has(exportName)) {
          moduleUnused.add(exportName);
        }
      }

      // 检查默认导出
      if (module.defaultExport && !used.has("default")) {
        moduleUnused.add("default");
      }

      if (moduleUnused.size > 0) {
        unused.set(file, moduleUnused);
      }
    }

    return unused;
  }

  /**
   * 计算未使用的导入
   */
  private calculateUnusedImports(): Map<string, Set<string>> {
    const unused = new Map<string, Set<string>>();

    for (const [file, module] of this.moduleGraph.modules) {
      const used = this.usedImports.get(file) || new Set();
      const moduleUnused = new Set<string>();

      for (const localName of module.imports.keys()) {
        if (!used.has(localName)) {
          moduleUnused.add(localName);
        }
      }

      if (moduleUnused.size > 0) {
        unused.set(file, moduleUnused);
      }
    }

    return unused;
  }

  /**
   * 识别死模块（整个模块都未被使用）
   */
  private identifyDeadModules(): Set<string> {
    const dead = new Set<string>();

    for (const [file, module] of this.moduleGraph.modules) {
      // 如果模块未被访问过，是死模块
      if (!this.visitedModules.has(file)) {
        // 但如果是副作用模块，不能删除
        if (!this.sideEffectModules.has(file)) {
          dead.add(file);
        }
      }
    }

    return dead;
  }

  /**
   * 计算统计信息
   */
  private calculateStats(): {
    totalExports: number;
    usedExportsCount: number;
    deadCodePercentage: number;
  } {
    let totalExports = 0;
    let usedExportsCount = 0;

    for (const [file, module] of this.moduleGraph.modules) {
      const moduleExports = module.exports.size;
      const hasDefault = module.defaultExport ? 1 : 0;
      totalExports += moduleExports + hasDefault;

      const used = this.usedExports.get(file);
      if (used) {
        usedExportsCount += used.size;
      }
    }

    const deadCodePercentage =
      totalExports > 0 ? ((totalExports - usedExportsCount) / totalExports) * 100 : 0;

    return {
      totalExports,
      usedExportsCount,
      deadCodePercentage,
    };
  }

  /**
   * 在模块中查找 binding
   */
  private findBindingInModule(file: string, name: string): Binding | undefined {
    const module = this.moduleGraph.modules.get(file);
    if (!module) return undefined;

    for (const binding of module.bindings) {
      if (binding.name === name) return binding;
    }

    return undefined;
  }

  /**
   * 解析模块路径
   */
  private resolveModulePath(importPath: string, fromFile: string): string | null {
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
      return null; // 第三方库
    }

    const path = require("path");
    const baseDir = path.dirname(fromFile);
    return path.resolve(baseDir, importPath);
  }

  /**
   * 解析路径为绝对路径
   */
  private resolvePath(filePath: string): string {
    const path = require("path");
    return path.resolve(filePath);
  }

  /**
   * 生成报告
   */
  generateReport(result: TreeShakingResult): string {
    const lines: string[] = [];

    lines.push("=".repeat(60));
    lines.push("Tree-shaking 分析报告");
    lines.push("=".repeat(60));

    // 统计
    lines.push("\n📊 统计信息:");
    lines.push(`  总导出数: ${result.stats.totalExports}`);
    lines.push(`  已使用导出: ${result.stats.usedExportsCount}`);
    lines.push(`  死代码占比: ${result.stats.deadCodePercentage.toFixed(2)}%`);

    // 副作用模块
    if (result.sideEffectModules.size > 0) {
      lines.push("\n⚠️ 副作用模块 (无法 tree-shaking):");
      for (const file of result.sideEffectModules) {
        lines.push(`  - ${file}`);
      }
    }

    // 死模块
    if (result.deadModules.size > 0) {
      lines.push("\n💀 死模块 (整个模块未使用):");
      for (const file of result.deadModules) {
        lines.push(`  - ${file}`);
      }
    }

    // 未使用的导出
    if (result.unusedExports.size > 0) {
      lines.push("\n🗑️ 未使用的导出:");
      for (const [file, exports] of result.unusedExports) {
        lines.push(`  ${file}:`);
        for (const exp of exports) {
          lines.push(`    - ${exp}`);
        }
      }
    }

    // 未使用的导入
    if (result.unusedImports.size > 0) {
      lines.push("\n🗑️ 未使用的导入:");
      for (const [file, imports] of result.unusedImports) {
        lines.push(`  ${file}:`);
        for (const imp of imports) {
          lines.push(`    - ${imp}`);
        }
      }
    }

    lines.push("\n" + "=".repeat(60));

    return lines.join("\n");
  }
}
