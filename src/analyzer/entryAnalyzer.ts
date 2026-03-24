import fs from "fs";
import path from "path";
import ts from "typescript";
import { analyzeFile } from "./core/analyzer";
import { ModuleGraph } from "./graph/module/moduleGraph";
import { AnalyzerContext } from "./core/context";

/**
 * 入口文件分析器
 * 从入口文件开始，递归分析所有依赖模块
 */
export class EntryAnalyzer {
  private visited = new Set<string>();
  private moduleGraph = new ModuleGraph();
  private contexts = new Map<string, AnalyzerContext>();

  constructor(private options: {
    baseDir?: string;
    resolvePath?: (importPath: string, fromFile: string) => string;
  } = {}) {}

  /**
   * 从入口文件开始分析
   * @param entryFile 入口文件路径
   * @returns 包含所有分析结果的对象
   */
  analyze(entryFile: string) {
    this.visited.clear();
    this.contexts.clear();

    // 标准化入口路径
    const absoluteEntry = path.resolve(entryFile);
    
    // 递归分析所有依赖
    this.analyzeRecursive(absoluteEntry);

    return {
      moduleGraph: this.moduleGraph,
      contexts: this.contexts,
      entryModule: this.moduleGraph.ensureModule(absoluteEntry),
    };
  }

  /**
   * 递归分析文件及其依赖
   */
  private analyzeRecursive(filePath: string): void {
    if (this.visited.has(filePath)) return;
    if (!fs.existsSync(filePath)) {
      console.warn(`文件不存在: ${filePath}`);
      return;
    }

    this.visited.add(filePath);

    // 分析当前文件
    const ctx = analyzeFile(filePath, this.moduleGraph);
    this.contexts.set(filePath, ctx);

    // 获取当前模块
    const module = this.moduleGraph.ensureModule(filePath);

    // 递归分析依赖
    for (const depPath of module.dependencies) {
      const resolvedPath = this.resolveModulePath(depPath, filePath);
      if (resolvedPath && !this.visited.has(resolvedPath)) {
        this.analyzeRecursive(resolvedPath);
      }
    }
  }

  /**
   * 解析模块路径
   */
  private resolveModulePath(importPath: string, fromFile: string): string | null {
    // 使用自定义解析器（如果提供）
    if (this.options.resolvePath) {
      return this.options.resolvePath(importPath, fromFile);
    }

    // 只处理相对路径和绝对路径
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
      // 第三方库，跳过
      return null;
    }

    const baseDir = path.dirname(fromFile);
    let resolved = path.resolve(baseDir, importPath);

    // 尝试添加扩展名
    const extensions = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];
    
    for (const ext of extensions) {
      const fullPath = resolved + ext;
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    // 如果本身就是完整路径
    if (fs.existsSync(resolved)) {
      return resolved;
    }

    return null;
  }

  /**
   * 获取分析的模块数量
   */
  getModuleCount(): number {
    return this.moduleGraph.modules.size;
  }

  /**
   * 获取所有上下文
   */
  getContexts(): Map<string, AnalyzerContext> {
    return this.contexts;
  }

  /**
   * 获取 ModuleGraph
   */
  getModuleGraph(): ModuleGraph {
    return this.moduleGraph;
  }
}
