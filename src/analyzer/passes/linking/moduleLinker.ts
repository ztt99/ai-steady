import { ModuleGraph } from "../../graph/module/moduleGraph";
import { SymbolGraph } from "../../graph/symbol/symbolGraph";
import { Binding } from "../../binding/Binding";

/**
 * 模块链接器
 * 在所有文件分析完成后，链接跨模块的导入导出关系
 */
export class ModuleLinker {
  constructor(private moduleGraph: ModuleGraph) {}

  /**
   * 链接所有模块的导入导出关系
   */
  link(): void {
    // 第一步：设置所有 binding 的 moduleId
    for (const [filePath, module] of this.moduleGraph.modules) {
      for (const binding of module.bindings) {
        binding.moduleId = filePath;
      }
    }

    // 第二步：链接导入导出
    for (const [filePath, module] of this.moduleGraph.modules) {
      // 处理每个导入
      for (const [localName, importInfo] of module.imports) {
        this.linkImport(filePath, localName, importInfo);
      }

      // 处理重新导出
      for (const reExport of module.reExports) {
        this.linkReExport(filePath, reExport);
      }
    }
  }

  /**
   * 链接单个导入
   */
  private linkImport(
    filePath: string,
    localName: string,
    importInfo: {
      localName: string;
      importedName: string;
      source: string;
    }
  ): void {
    // 解析源模块路径
    const sourceModule = this.resolveModulePath(importInfo.source, filePath);
    if (!sourceModule) return;

    const source = this.moduleGraph.modules.get(sourceModule);
    if (!source) return;

    // 获取导入的 binding
    const importBinding = this.findBindingInModule(filePath, localName);
    if (!importBinding) return;

    // 查找导出的 binding
    let exportBinding: Binding | undefined;

    if (importInfo.importedName === "default") {
      // 默认导入
      exportBinding = source.defaultExport;
    } else if (importInfo.importedName === "*") {
      // 命名空间导入 - 特殊处理，指向模块命名空间
      exportBinding = this.findBindingInModule(sourceModule, localName);
    } else {
      // 命名导入
      exportBinding = source.exports.get(importInfo.importedName);
    }

    if (exportBinding) {
      // 建立实时绑定链接
      // importBinding 是 exportBinding 的一个"视图"
      importBinding.exportSource = exportBinding;
      
      // 反向链接：exportBinding 被 importBinding 导入
      if (!exportBinding.importedBy.includes(importBinding)) {
        exportBinding.importedBy.push(importBinding);
      }
    }
  }

  /**
   * 链接重新导出
   */
  private linkReExport(
    filePath: string,
    reExport: {
      source: string;
      exportClause: import("typescript").NamedExports | import("typescript").NamespaceExport | undefined;
    }
  ): void {
    const sourceModule = this.resolveModulePath(reExport.source, filePath);
    if (!sourceModule) return;

    const source = this.moduleGraph.modules.get(sourceModule);
    const target = this.moduleGraph.modules.get(filePath);
    if (!source || !target) return;

    // export * from './module'
    if (!reExport.exportClause) {
      // 将源模块的所有导出添加到当前模块的导出
      for (const [name, binding] of source.exports) {
        if (!target.exports.has(name)) {
          target.exports.set(name, binding);
          // 标记为重新导出
          (binding as any).reExportedFrom = sourceModule;
        }
      }
    }
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
   * 在模块中查找 binding
   */
  private findBindingInModule(filePath: string, name: string): Binding | undefined {
    const module = this.moduleGraph.modules.get(filePath);
    if (!module) return undefined;

    for (const binding of module.bindings) {
      if (binding.name === name) return binding;
    }

    return undefined;
  }

  /**
   * 获取跨模块的依赖图
   * 返回模块间的依赖关系
   */
  getModuleDependencyGraph(): {
    nodes: Array<{ id: string; exports: string[]; imports: string[] }>;
    edges: Array<{ from: string; to: string; imports: string[] }>;
  } {
    const nodes: Array<{ id: string; exports: string[]; imports: string[] }> = [];
    const edges: Array<{ from: string; to: string; imports: string[] }> = [];

    for (const [filePath, module] of this.moduleGraph.modules) {
      nodes.push({
        id: filePath,
        exports: Array.from(module.exports.keys()),
        imports: Array.from(module.imports.keys()),
      });

      // 构建模块间的边
      const importsBySource = new Map<string, string[]>();
      for (const [, importInfo] of module.imports) {
        const resolved = this.resolveModulePath(importInfo.source, filePath);
        if (resolved) {
          if (!importsBySource.has(resolved)) {
            importsBySource.set(resolved, []);
          }
          importsBySource.get(resolved)!.push(importInfo.localName);
        }
      }

      for (const [source, importedNames] of importsBySource) {
        edges.push({
          from: filePath,
          to: source,
          imports: importedNames,
        });
      }
    }

    return { nodes, edges };
  }
}
