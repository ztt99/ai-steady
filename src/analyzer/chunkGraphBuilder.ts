import { Binding } from "./binding/Binding";
import { ModuleGraph } from "./graph/module/moduleGraph";
import { Module } from "./graph/module/module";
import fs from "fs";
/**
 * Chunk 类型
 */
export type ChunkType = "entry" | "async" | "common" | "vendor";

/**
 * Chunk 中的模块信息
 */
export interface ChunkModule {
  /** 模块路径 */
  path: string;
  /** 模块导出的 binding */
  exports: Binding[];
  /** 模块导入的 binding */
  imports: Map<string, string>; // localName -> sourceModule
  /** 是否是异步导入 */
  isAsyncImport: boolean;
  code: string;
}

/**
 * Chunk 依赖边
 */
export interface ChunkEdge {
  from: string;
  to: string;
  /** 依赖类型 */
  type: "static" | "dynamic" | "prefetch" | "preload";
  /** 导入的模块 */
  imports?: string[];
}

/**
 * Chunk 节点
 */
export interface Chunk {
  /** Chunk ID */
  id: string;
  /** Chunk 名称 */
  name: string;
  /** Chunk 类型 */
  type: ChunkType;
  /** 入口模块（仅 entry 类型） */
  entryModule?: string;
  /** Chunk 包含的模块 */
  modules: Map<string, ChunkModule>;
  /** Chunk 大小估算（字节） */
  size: number;
  /** 被哪些 chunk 依赖 */
  parents: Set<string>;
  /** 依赖哪些 chunk */
  children: Set<string>;
  /** 异步依赖的 chunk */
  asyncDeps: Set<string>;
}

/**
 * Chunk Graph
 */
export interface ChunkGraph {
  chunks: Map<string, Chunk>;
  edges: ChunkEdge[];
  entryChunks: Set<string>;
  /** 模块到 chunk 的映射 */
  moduleToChunk: Map<string, string>;
}

/**
 * Chunk Graph 构建选项
 */
export interface ChunkGraphOptions {
  /** 入口配置 */
  entries: Record<string, string>;
  /** 代码分割配置 */
  splitChunks?: {
    /**  vendors chunk 最小大小 */
    minSize?: number;
    /** 提取 vendors 的正则 */
    vendors?: RegExp;
    /** 公共模块最小引用次数 */
    minChunks?: number;
    /** 最大异步请求数 */
    maxAsyncRequests?: number;
    /** 最大初始请求数 */
    maxInitialRequests?: number;
    /** 缓存组 */
    cacheGroups?: Array<{
      name: string;
      /** 匹配模块的正则，不填则匹配所有模块 */
      test?: RegExp;
      priority?: number;
      /** 最小引用次数 */
      minChunks?: number;
      /** 最小大小 */
      minSize?: number;
    }>;
  };
  /** 动态导入配置 */
  dynamicImports?: {
    /** 是否预加载 */
    prefetch?: boolean;
    /** 是否预获取 */
    preload?: boolean;
  };
}

/**
 * Chunk Graph 构建器
 * 分析代码分割，构建 chunk 依赖图
 */
export class ChunkGraphBuilder {
  private chunks = new Map<string, Chunk>();
  private edges: ChunkEdge[] = [];
  private entryChunks = new Set<string>();
  private moduleToChunk = new Map<string, string>();
  private moduleGraph: ModuleGraph;
  private options: ChunkGraphOptions;

  constructor(moduleGraph: ModuleGraph, options: ChunkGraphOptions) {
    this.moduleGraph = moduleGraph;
    this.options = options;
  }

  /**
   * 构建 Chunk Graph
   */
  build(): ChunkGraph {
    this.chunks.clear();
    this.edges = [];
    this.entryChunks.clear();
    this.moduleToChunk.clear();

    // 1. 为每个入口创建 entry chunk
    this.createEntryChunks();

    // 2. 识别动态导入，创建 async chunks
    this.createAsyncChunks();

    // 3. 应用代码分割策略
    this.applySplitChunks();

    // 4. 构建 chunk 之间的依赖关系
    this.buildChunkDependencies();

    // 5. 计算 chunk 大小
    this.calculateChunkSizes();

    return {
      chunks: this.chunks,
      edges: this.edges,
      entryChunks: this.entryChunks,
      moduleToChunk: this.moduleToChunk,
    };
  }

  /**
   * 创建入口 chunks
   */
  private createEntryChunks(): void {
    for (const [entryName, entryPath] of Object.entries(this.options.entries)) {
      const chunkId = `entry-${entryName}`;
      const chunk: Chunk = {
        id: chunkId,
        name: entryName,
        type: "entry",
        entryModule: entryPath,
        modules: new Map(),
        size: 0,
        parents: new Set(),
        children: new Set(),
        asyncDeps: new Set(),
      };

      // 递归收集入口的所有同步依赖
      this.collectSyncDependencies(entryPath, chunk);

      this.chunks.set(chunkId, chunk);
      this.entryChunks.add(chunkId);
    }
  }

  /**
   * 识别动态导入，创建异步 chunks
   */
  private createAsyncChunks(): void {
    for (const [filePath, module] of this.moduleGraph.modules) {
      // 检查是否有动态导入
      for (const dep of module.dependencies) {
        if (this.isDynamicImport(filePath, dep)) {
          const chunkId = `async-${this.generateChunkId(dep)}`;

          if (!this.chunks.has(chunkId)) {
            const chunk: Chunk = {
              id: chunkId,
              name: this.generateChunkName(dep),
              type: "async",
              modules: new Map(),
              size: 0,
              parents: new Set(),
              children: new Set(),
              asyncDeps: new Set(),
            };

            // 收集异步 chunk 的依赖
            const resolvedDep = this.resolveModulePath(dep, filePath);
            if (resolvedDep) {
              this.collectSyncDependencies(resolvedDep, chunk);
            }

            this.chunks.set(chunkId, chunk);
          }

          // 记录异步依赖关系
          const parentChunkId = this.moduleToChunk.get(filePath);
          if (parentChunkId) {
            const parentChunk = this.chunks.get(parentChunkId);
            if (parentChunk) {
              parentChunk.asyncDeps.add(chunkId);
            }

            // 添加 chunk 边
            this.edges.push({
              from: parentChunkId,
              to: chunkId,
              type: "dynamic",
              imports: [dep],
            });
          }
        }
      }
    }
  }

  /**
   * 应用代码分割策略
   */
  private applySplitChunks(): void {
    const { splitChunks } = this.options;
    if (!splitChunks) return;

    // 1. 提取 vendors
    if (splitChunks.vendors) {
      this.extractVendors(splitChunks.vendors);
    }

    // 2. 提取公共模块
    if (splitChunks.minChunks) {
      this.extractCommonChunks(splitChunks.minChunks);
    }

    // 3. 应用缓存组
    if (splitChunks.cacheGroups) {
      for (const group of splitChunks.cacheGroups) {
        this.applyCacheGroup(group);
      }
    }
  }

  /**
   * 提取 vendors chunk
   */
  private extractVendors(vendorsRegex: RegExp): void {
    const vendorModules = new Map<string, Module>();

    // 收集所有匹配的模块
    for (const [filePath, module] of this.moduleGraph.modules) {
      if (vendorsRegex.test(filePath)) {
        vendorModules.set(filePath, module);
      }
    }

    if (vendorModules.size === 0) return;

    // 创建 vendors chunk
    const chunkId = "vendors";
    const chunk: Chunk = {
      id: chunkId,
      name: "vendors",
      type: "vendor",
      modules: new Map(),
      size: 0,
      parents: new Set(),
      children: new Set(),
      asyncDeps: new Set(),
    };

    // 从现有 chunks 中移除 vendor 模块，添加到 vendors chunk
    for (const [filePath, module] of vendorModules) {
      // 从原 chunk 中移除
      const oldChunkId = this.moduleToChunk.get(filePath);
      if (oldChunkId && oldChunkId !== chunkId) {
        const oldChunk = this.chunks.get(oldChunkId);
        if (oldChunk) {
          oldChunk.modules.delete(filePath);
        }
      }

      // 添加到 vendors chunk
      chunk.modules.set(filePath, {
        path: filePath,
        exports: Array.from(module.exports.values()),
        imports: new Map(Array.from(module.imports.entries()).map(([k, v]) => [k, v.source])),
        isAsyncImport: false,
        code: fs.readFileSync(filePath, "utf-8"),
      });

      this.moduleToChunk.set(filePath, chunkId);
    }

    this.chunks.set(chunkId, chunk);

    // 添加依赖边：所有引用了 vendor 模块的 chunk 都应该依赖 vendors chunk
    const parentChunkIds = new Set<string>();
    for (const [filePath, module] of vendorModules) {
      const oldChunkId = this.moduleToChunk.get(filePath);
      if (oldChunkId && oldChunkId !== chunkId) {
        parentChunkIds.add(oldChunkId);
      }
    }

    for (const parentChunkId of parentChunkIds) {
      this.edges.push({
        from: parentChunkId,
        to: chunkId,
        type: "static",
      });
      chunk.parents.add(parentChunkId);
    }
  }

  /**
   * 提取公共模块到单独的 chunk
   */
  private extractCommonChunks(minChunks: number): void {
    // 统计每个模块被多少个 chunk 引用
    const moduleUsage = new Map<string, Set<string>>();

    for (const [chunkId, chunk] of this.chunks) {
      for (const filePath of chunk.modules.keys()) {
        if (!moduleUsage.has(filePath)) {
          moduleUsage.set(filePath, new Set());
        }
        moduleUsage.get(filePath)!.add(chunkId);
      }
    }

    // 找出被多个 chunk 引用的模块
    const commonModules = new Map<string, Set<string>>();
    for (const [filePath, chunks] of moduleUsage) {
      if (chunks.size >= minChunks) {
        commonModules.set(filePath, chunks);
      }
    }

    if (commonModules.size === 0) return;

    // 创建 common chunk
    const chunkId = "common";
    const chunk: Chunk = {
      id: chunkId,
      name: "common",
      type: "common",
      modules: new Map(),
      size: 0,
      parents: new Set(),
      children: new Set(),
      asyncDeps: new Set(),
    };

    // 添加公共模块
    for (const [filePath] of commonModules) {
      const module = this.moduleGraph.modules.get(filePath);
      if (module) {
        // 从原 chunks 中移除
        for (const [cid, chk] of this.chunks) {
          if (cid !== chunkId && chk.modules.has(filePath)) {
            chk.modules.delete(filePath);
          }
        }

        // 添加到 common chunk
        chunk.modules.set(filePath, {
          path: filePath,
          exports: Array.from(module.exports.values()),
          imports: new Map(Array.from(module.imports.entries()).map(([k, v]) => [k, v.source])),
          isAsyncImport: false,
          code: fs.readFileSync(filePath, "utf-8"),
        });

        this.moduleToChunk.set(filePath, chunkId);
      }
    }

    this.chunks.set(chunkId, chunk);

    // 添加依赖边
    for (const [filePath, chunks] of commonModules) {
      for (const parentChunkId of chunks) {
        if (parentChunkId !== chunkId) {
          this.edges.push({
            from: parentChunkId,
            to: chunkId,
            type: "static",
          });
          chunk.parents.add(parentChunkId);
        }
      }
    }
  }

  /**
   * Apply cache group
   * If no test provided, matches all modules (equivalent to test: /. * /)
   */
  private applyCacheGroup(group: {
    name: string;
    test?: RegExp;
    priority?: number;
    minChunks?: number;
    minSize?: number;
  }): void {
    const matchedModules = new Map<string, Module>();

    // If no test provided, default to matching all modules
    const testRegex = group.test || /.*/;

    for (const [filePath, module] of this.moduleGraph.modules) {
      if (testRegex.test(filePath)) {
        matchedModules.set(filePath, module);
      }
    }

    // Filter by minChunks if specified
    if (group.minChunks && group.minChunks > 1) {
      for (const [filePath] of matchedModules) {
        const refCount = this.getModuleReferenceCount(filePath);
        if (refCount < group.minChunks) {
          matchedModules.delete(filePath);
        }
      }
    }

    if (matchedModules.size === 0) return;

    // Filter by minChunks if specified
    if (group.minChunks && group.minChunks > 1) {
      for (const [filePath] of matchedModules) {
        const refCount = this.getModuleReferenceCount(filePath);
        if (refCount < group.minChunks) {
          matchedModules.delete(filePath);
        }
      }
    }

    if (matchedModules.size === 0) return;

    const chunkId = `cache-${group.name}`;
    const chunk: Chunk = {
      id: chunkId,
      name: group.name,
      type: "common",
      modules: new Map(),
      size: 0,
      parents: new Set(),
      children: new Set(),
      asyncDeps: new Set(),
    };

    for (const [filePath, module] of matchedModules) {
      // 从原 chunk 中移除
      const oldChunkId = this.moduleToChunk.get(filePath);
      if (oldChunkId && oldChunkId !== chunkId) {
        const oldChunk = this.chunks.get(oldChunkId);
        if (oldChunk) {
          oldChunk.modules.delete(filePath);
        }
      }

      chunk.modules.set(filePath, {
        path: filePath,
        exports: Array.from(module.exports.values()),
        imports: new Map(Array.from(module.imports.entries()).map(([k, v]) => [k, v.source])),
        isAsyncImport: false,
        code: fs.readFileSync(filePath, "utf-8"),
      });

      this.moduleToChunk.set(filePath, chunkId);
    }

    this.chunks.set(chunkId, chunk);
  }

  /**
   * 构建 chunk 之间的依赖关系
   */
  private buildChunkDependencies(): void {
    // 分析模块间的依赖，建立 chunk 间的边
    for (const [filePath, module] of this.moduleGraph.modules) {
      const sourceChunkId = this.moduleToChunk.get(filePath);
      if (!sourceChunkId) continue;

      for (const [localName, importInfo] of module.imports) {
        const targetPath = this.resolveModulePath(importInfo.source, filePath);
        if (!targetPath) continue;

        const targetChunkId = this.moduleToChunk.get(targetPath);
        if (!targetChunkId || targetChunkId === sourceChunkId) continue;

        // 检查是否已存在边
        const exists = this.edges.some((e) => e.from === sourceChunkId && e.to === targetChunkId);

        if (!exists) {
          const isDynamic = this.isDynamicImport(filePath, importInfo.source);
          this.edges.push({
            from: sourceChunkId,
            to: targetChunkId,
            type: isDynamic ? "dynamic" : "static",
            imports: [localName],
          });

          // 更新 chunk 的父子关系
          const sourceChunk = this.chunks.get(sourceChunkId);
          const targetChunk = this.chunks.get(targetChunkId);
          if (sourceChunk && targetChunk) {
            if (isDynamic) {
              sourceChunk.asyncDeps.add(targetChunkId);
            } else {
              sourceChunk.children.add(targetChunkId);
              targetChunk.parents.add(sourceChunkId);
            }
          }
        }
      }
    }
  }

  /**
   * 计算 chunk 大小
   */
  private calculateChunkSizes(): void {
    for (const [chunkId, chunk] of this.chunks) {
      let size = 0;
      for (const [filePath] of chunk.modules) {
        // 估算大小（实际应该读取文件内容计算 gzip 大小）
        const module = this.moduleGraph.modules.get(filePath);
        if (module) {
          // 简单估算：binding 数量 * 估算字节数
          size += module.bindings.size * 100;
          size += module.exports.size * 50;
        }
      }
      chunk.size = size;
    }
  }

  /**
   * 收集同步依赖
   */
  private collectSyncDependencies(entryPath: string, chunk: Chunk): void {
    const visited = new Set<string>();
    const queue = [entryPath];

    while (queue.length > 0) {
      const filePath = queue.shift()!;
      if (visited.has(filePath)) continue;
      visited.add(filePath);

      const module = this.moduleGraph.modules.get(filePath);
      if (!module) continue;

      // 添加到 chunk
      if (!chunk.modules.has(filePath)) {
        chunk.modules.set(filePath, {
          path: filePath,
          exports: Array.from(module.exports.values()),
          imports: new Map(Array.from(module.imports.entries()).map(([k, v]) => [k, v.source])),
          isAsyncImport: false,
          code: fs.readFileSync(filePath, "utf-8"),
        });

        this.moduleToChunk.set(filePath, chunk.id);
      }

      // 递归收集同步依赖
      for (const dep of module.dependencies) {
        if (!this.isDynamicImport(filePath, dep)) {
          const resolvedDep = this.resolveModulePath(dep, filePath);
          if (resolvedDep) {
            queue.push(resolvedDep);
          }
        }
      }
    }
  }

  /**
   * 判断是否是动态导入
   */
  private isDynamicImport(filePath: string, dep: string): boolean {
    // 这里简化判断，实际应该通过 AST 分析
    // 检查是否有 import() 语法
    const module = this.moduleGraph.modules.get(filePath);
    if (!module) return false;

    // 检查导入信息
    for (const [, importInfo] of module.imports) {
      if (importInfo.source === dep) {
        // 如果没有对应的同步导入声明，可能是动态导入
        // 实际应该通过分析 AST 中的 ImportExpression 判断
        return false; // 简化处理，默认都是同步
      }
    }

    return false;
  }

  /**
   * 解析模块路径
   */
  private resolveModulePath(importPath: string, fromFile: string): string | null {
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
      return null;
    }

    const path = require("path");
    const baseDir = path.dirname(fromFile);
    return path.resolve(baseDir, importPath);
  }

  /**
   * 生成 chunk ID
   */
  private generateChunkId(modulePath: string): string {
    return modulePath.replace(/[^a-zA-Z0-9]/g, "-");
  }

  /**
   * 生成 chunk 名称
   */
  private generateChunkName(modulePath: string): string {
    const path = require("path");
    return path.basename(modulePath, path.extname(modulePath));
  }

  /**
   * 生成报告
   */
  generateReport(graph: ChunkGraph): string {
    const lines: string[] = [];

    lines.push("=".repeat(60));
    lines.push("Chunk Graph 分析报告");
    lines.push("=".repeat(60));

    // 概览
    lines.push("\n📊 概览:");
    lines.push(`  总 Chunk 数: ${graph.chunks.size}`);
    lines.push(`  Entry Chunks: ${graph.entryChunks.size}`);
    lines.push(`  依赖边数: ${graph.edges.length}`);

    // Entry Chunks
    lines.push("\n🚪 Entry Chunks:");
    for (const chunkId of graph.entryChunks) {
      const chunk = graph.chunks.get(chunkId)!;
      lines.push(`  ${chunk.name}:`);
      lines.push(`    模块数: ${chunk.modules.size}`);
      lines.push(`    估算大小: ${(chunk.size / 1024).toFixed(2)} KB`);
      lines.push(`    异步依赖: ${chunk.asyncDeps.size} 个`);
    }

    // Async Chunks
    const asyncChunks = Array.from(graph.chunks.values()).filter((c) => c.type === "async");
    if (asyncChunks.length > 0) {
      lines.push("\n⚡ Async Chunks (代码分割):");
      for (const chunk of asyncChunks) {
        lines.push(`  ${chunk.name}:`);
        lines.push(`    模块数: ${chunk.modules.size}`);
        lines.push(`    父 chunks: ${Array.from(chunk.parents).join(", ")}`);
      }
    }

    // Vendor/Common Chunks
    const vendorChunks = Array.from(graph.chunks.values()).filter(
      (c) => c.type === "vendor" || c.type === "common",
    );
    if (vendorChunks.length > 0) {
      lines.push("\n📦 Vendor/Common Chunks:");
      for (const chunk of vendorChunks) {
        lines.push(`  ${chunk.name}:`);
        lines.push(`    模块数: ${chunk.modules.size}`);
        lines.push(`    被引用: ${chunk.parents.size} 次`);
      }
    }

    // 依赖关系
    lines.push("\n🔗 Chunk 依赖关系:");
    for (const edge of graph.edges) {
      const arrow = edge.type === "dynamic" ? "~>" : "->";
      lines.push(`  ${edge.from} ${arrow} ${edge.to} (${edge.type})`);
    }

    // 优化建议
    lines.push("\n💡 优化建议:");
    const largeChunks = Array.from(graph.chunks.values()).filter((c) => c.size > 244 * 1024); // > 244KB
    if (largeChunks.length > 0) {
      lines.push(`  发现 ${largeChunks.length} 个超大 chunk (>244KB):`);
      for (const chunk of largeChunks) {
        lines.push(`    - ${chunk.name}: ${(chunk.size / 1024).toFixed(2)} KB`);
      }
      lines.push("    建议: 进一步分割代码或启用压缩");
    }

    // 重复模块检测
    const duplicates = this.findDuplicateModules(graph);
    if (duplicates.length > 0) {
      lines.push(`  发现 ${duplicates.length} 个模块被多个 chunk 重复包含`);
      lines.push("    建议: 提取到 common chunk");
    }

    lines.push("\n" + "=".repeat(60));
    return lines.join("\n");
  }

  /**
   * 获取模块被引用的次数（被多少个 chunk 引用）
   */
  private getModuleReferenceCount(filePath: string): number {
    let count = 0;
    for (const [_, chunk] of this.chunks) {
      if (chunk.modules.has(filePath)) {
        count++;
      }
    }
    return count;
  }

  /**
   * 查找重复模块
   */
  private findDuplicateModules(graph: ChunkGraph): string[] {
    const moduleToChunks = new Map<string, string[]>();

    for (const [chunkId, chunk] of graph.chunks) {
      for (const filePath of chunk.modules.keys()) {
        if (!moduleToChunks.has(filePath)) {
          moduleToChunks.set(filePath, []);
        }
        moduleToChunks.get(filePath)!.push(chunkId);
      }
    }

    return Array.from(moduleToChunks.entries())
      .filter(([_, chunks]) => chunks.length > 1)
      .map(([filePath]) => filePath);
  }

  /**
   * 生成 webpack 配置建议
   */
  generateWebpackConfigSuggestion(graph: ChunkGraph): object {
    return {
      entry: this.options.entries,
      output: {
        filename: "[name].[contenthash:8].js",
        chunkFilename: "[name].[contenthash:8].chunk.js",
      },
      optimization: {
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              name: "vendors",
            },
            common: {
              minChunks: 2,
              priority: 5,
              name: "common",
            },
          },
        },
      },
    };
  }
}
