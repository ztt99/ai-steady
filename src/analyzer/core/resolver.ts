import ts from "typescript";
import { Binding } from "../binding/Binding";
import { AnalyzerContext } from "./context";
import { ImportBinding, Module, ReExportInfo } from "../graph/module/module";

/**
 * 解析结果
 */
export interface ResolveResult {
  /** 找到的绑定 */
  binding: Binding | null;
  /** 是否是本地绑定 */
  isLocal: boolean;
  /** 来源模块路径（本地则为当前文件） */
  source: string;
  /** 导入链（如果是跨文件导入） */
  importChain: ImportChainItem[];
  /** 是否通过 export * from 解析 */
  isStarExport: boolean;
}

/**
 * 导入链项
 */
export interface ImportChainItem {
  /** 本地名称 */
  localName: string;
  /** 导入来源模块 */
  source: string;
  /** 在源模块中的名称 */
  importedName: string;
}

/**
 * 跨文件变量解析器
 *
 * 职责：
 * 1. 解析本地作用域中的变量
 * 2. 追踪导入变量到源模块
 * 3. 处理重新导出 (export { ... } from / export * from)
 * 4. 解析完整的导入链条
 */
export class Resolver {
  private ctx: AnalyzerContext;
  /** 缓存已解析的结果，避免循环导入 */
  private cache = new Map<string, ResolveResult>();
  /** 当前解析栈，用于检测循环导入 */
  private resolveStack = new Set<string>();

  constructor(ctx: AnalyzerContext) {
    this.ctx = ctx;
  }

  /**
   * 解析标识符
   *
   * @param name - 变量名
   * @param file - 起始文件路径
   * @param scope - 可选的作用域，优先在此作用域中查找
   * @returns 解析结果
   *
   * 解析顺序：
   * 1. 先在当前作用域链中查找
   * 2. 如果未找到，检查是否是导入的
   * 3. 如果是导入的，递归解析到源模块
   * 4. 处理重新导出
   */
  resolve(name: string, file: string, scope = this.ctx.currentScope): ResolveResult {
    const cacheKey = `${file}#${name}`;

    // 检查缓存
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 检测循环导入
    if (this.resolveStack.has(cacheKey)) {
      return {
        binding: null,
        isLocal: false,
        source: file,
        importChain: [],
        isStarExport: false,
      };
    }

    this.resolveStack.add(cacheKey);

    try {
      const result = this.doResolve(name, file, scope);
      this.cache.set(cacheKey, result);
      return result;
    } finally {
      this.resolveStack.delete(cacheKey);
    }
  }

  /**
   * 执行实际的解析逻辑
   */
  private doResolve(name: string, file: string, scope = this.ctx.currentScope): ResolveResult {
    const module = this.ctx.graph.ensureModule(file);

    // 1. 先在当前作用域链中查找本地绑定
    const localBinding = scope.resolve(name);
    if (localBinding) {
      // 检查是否是导入的（通过 import 语句引入的绑定）
      const importBinding = module.imports.get(name);
      if (importBinding) {
        // 是导入的，需要追踪到源
        return this.resolveImport(importBinding, file, name);
      }

      // 真正的本地绑定
      return {
        binding: localBinding,
        isLocal: true,
        source: file,
        importChain: [],
        isStarExport: false,
      };
    }

    // 2. 检查是否是导入的（在当前文件中未定义，但在 imports 中有）
    const importBinding = module.imports.get(name);
    if (importBinding) {
      return this.resolveImport(importBinding, file, name);
    }

    // 3. 未找到
    return {
      binding: null,
      isLocal: false,
      source: file,
      importChain: [],
      isStarExport: false,
    };
  }

  /**
   * 解析导入绑定
   *
   * @param importBinding - 导入绑定信息
   * @param currentFile - 当前文件路径
   * @param localName - 本地使用的名称
   * @returns 解析结果
   */
  private resolveImport(
    importBinding: ImportBinding,
    currentFile: string,
    localName: string,
  ): ResolveResult {
    const sourceModule = importBinding.source;

    // 检查是否是命名空间导入 import * as foo from '...'
    if (importBinding.importedName === "*") {
      // 命名空间导入，返回模块本身
      return {
        binding: null,
        isLocal: false,
        source: sourceModule,
        importChain: [
          {
            localName,
            source: sourceModule,
            importedName: "*",
          },
        ],
        isStarExport: false,
      };
    }

    // 获取源模块
    const targetModule = this.ctx.graph.ensureModule(sourceModule);
    // 在源模块中查找导出
    const exportResult = this.resolveExport(targetModule, importBinding.localName);

    if (exportResult.found) {
      // 找到导出
      const chain: ImportChainItem[] = [
        {
          localName,
          source: sourceModule,
          importedName: importBinding.localName,
        },
      ];

      // 如果导出的是另一个导入，继续追踪
      if (!exportResult.binding && exportResult.reExport) {
        const reExportResult = this.resolveReExport(
          exportResult.reExport,
          importBinding.localName,
          sourceModule,
        );
        return {
          binding: reExportResult.binding,
          isLocal: false,
          source: reExportResult.source,
          importChain: [...chain, ...reExportResult.importChain],
          isStarExport: reExportResult.isStarExport,
        };
      }

      return {
        binding: exportResult.binding,
        isLocal: false,
        source: sourceModule,
        importChain: chain,
        isStarExport: false,
      };
    }

    // 未找到导出
    return {
      binding: null,
      isLocal: false,
      source: sourceModule,
      importChain: [
        {
          localName,
          source: sourceModule,
          importedName: importBinding.localName,
        },
      ],
      isStarExport: false,
    };
  }

  /**
   * 在模块中查找导出
   *
   * @param module - 目标模块
   * @param name - 导出名称
   * @returns 导出结果
   */
  private resolveExport(module: Module, name: string): ExportResult {
    // 1. 检查命名导出
    const namedExport = module.exports.get(name);
    if (namedExport) {
      return { found: true, binding: namedExport, reExport: null };
    }

    // 2. 检查默认导出
    if (name === "default" && module.defaultExport) {
      return { found: true, binding: module.defaultExport, reExport: null };
    }

    // 3. 检查重新导出
    for (const reExport of module.reExports) {
      // export * from '...'
      if (!reExport.exportClause) {
        // 需要在源模块中查找
        const targetModule = this.ctx.graph.ensureModule(reExport.source);
        const result = this.resolveExport(targetModule, name);
        if (result.found) {
          return { found: true, binding: result.binding, reExport };
        }
      }
      // export { foo, bar as baz } from '...'
      else if (reExport.exportClause && ts.isNamedExports(reExport.exportClause)) {
        for (const element of reExport.exportClause.elements) {
          const exportName = element.name.text;
          const originalName = element.propertyName?.text ?? exportName;
          if (exportName === name) {
            return { found: true, binding: null, reExport };
          }
        }
      }
    }

    return { found: false, binding: null, reExport: null };
  }

  /**
   * 解析重新导出
   *
   * @param reExport - 重新导出信息
   * @param name - 导出名称
   * @param currentModule - 当前模块路径
   * @returns 解析结果
   */
  private resolveReExport(
    reExport: ReExportInfo,
    name: string,
    currentModule: string,
  ): ResolveResult {
    const sourceModule = this.ctx.graph.ensureModule(reExport.source);

    // 在源模块中查找
    const result = this.resolveExport(sourceModule, name);

    if (result.found && result.binding) {
      return {
        binding: result.binding,
        isLocal: false,
        source: reExport.source,
        importChain: [
          {
            localName: name,
            source: reExport.source,
            importedName: name,
          },
        ],
        isStarExport: !reExport.exportClause,
      };
    }

    // 如果是 export * from，继续递归
    if (!reExport.exportClause && result.found && result.reExport) {
      const nestedResult = this.resolveReExport(result.reExport, name, reExport.source);
      return {
        binding: nestedResult.binding,
        isLocal: false,
        source: nestedResult.source,
        importChain: [
          {
            localName: name,
            source: reExport.source,
            importedName: name,
          },
          ...nestedResult.importChain,
        ],
        isStarExport: nestedResult.isStarExport || !reExport.exportClause,
      };
    }

    return {
      binding: null,
      isLocal: false,
      source: reExport.source,
      importChain: [
        {
          localName: name,
          source: reExport.source,
          importedName: name,
        },
      ],
      isStarExport: !reExport.exportClause,
    };
  }

  /**
   * 解析导入链 - 获取完整的导入路径
   *
   * @param name - 变量名
   * @param file - 起始文件路径
   * @returns 完整的导入链
   */
  resolveChain(name: string, file: string): ImportChainItem[] {
    const result = this.resolve(name, file);
    return result.importChain;
  }

  /**
   * 批量解析多个标识符
   *
   * @param names - 变量名数组
   * @param file - 起始文件路径
   * @returns 解析结果映射
   */
  resolveMany(names: string[], file: string): Map<string, ResolveResult> {
    const results = new Map<string, ResolveResult>();
    for (const name of names) {
      results.set(name, this.resolve(name, file));
    }
    return results;
  }

  /**
   * 获取变量定义的文件路径
   *
   * @param name - 变量名
   * @param file - 起始文件路径
   * @returns 定义该变量的文件路径，未找到返回 null
   */
  getDefinitionFile(name: string, file: string): string | null {
    const result = this.resolve(name, file);
    return result.binding ? result.source : null;
  }

  /**
   * 检查变量是否是跨文件导入的
   *
   * @param name - 变量名
   * @param file - 文件路径
   * @returns 是否是导入的变量
   */
  isImported(name: string, file: string): boolean {
    const result = this.resolve(name, file);
    return !result.isLocal && result.importChain.length > 0;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
    this.resolveStack.clear();
  }
}

/**
 * 导出查找结果
 */
interface ExportResult {
  found: boolean;
  binding: Binding | null;
  reExport: ReExportInfo | null;
}

/**
 * 创建解析器的便捷函数
 */
export function createResolver(ctx: AnalyzerContext): Resolver {
  return new Resolver(ctx);
}

/**
 * 便捷函数：解析单个标识符
 */
export function resolveIdentifier(ctx: AnalyzerContext, name: string, file: string): ResolveResult {
  const resolver = new Resolver(ctx);
  return resolver.resolve(name, file);
}
