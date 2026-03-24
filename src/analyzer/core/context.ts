import ts from "typescript";
import { Scope } from "../scope/scope";
import { Binding } from "../binding/Binding";
import Reference from "../reference/reference";
import { ModuleGraph } from "../graph/module/moduleGraph";
import { SymbolGraph } from "../graph/symbol/symbolGraph";
import { Resolver, ResolveResult } from "./resolver";

export class AnalyzerContext {
  sourceFile: ts.SourceFile;
  filePath: string;

  // scope
  currentScope!: Scope;

  // binding stack
  currentBinding?: Binding;
  currentFunctionBinding?: Binding;

  // data
  references: Reference[] = [];

  // graph
  symbolGraph = new SymbolGraph();
  moduleGraph: ModuleGraph;

  scopeMap = new Map();

  // resolver
  private resolver?: Resolver;

  constructor(filePath: string, sourceFile: ts.SourceFile, moduleGraph: ModuleGraph) {
    this.filePath = filePath;
    this.sourceFile = sourceFile;

    this.moduleGraph = moduleGraph;
    this.currentScope = new Scope("global");
    this.scopeMap.set(sourceFile, this.currentScope);
  }

  /**
   * 获取解析器实例（懒加载）
   */
  getResolver(): Resolver {
    if (!this.resolver) {
      this.resolver = new Resolver(this);
    }
    return this.resolver;
  }

  pushScope(type: "function" | "block") {
    this.currentScope = new Scope(type, this.currentScope);
  }

  popScope() {
    if (this.currentScope.parent) {
      this.currentScope = this.currentScope.parent;
    }
  }

  getScope(node: ts.Node) {
    let nNode = node;
    let scope = this.scopeMap.get(nNode);
    while (!scope) {
      nNode = nNode.parent;
      scope = this.scopeMap.get(nNode);
    }
    return scope;
  }

  /**
   * 解析变量（跨文件）
   * @param name - 变量名
   * @param file - 文件路径
   * @returns 解析结果
   */
  resolve(name: string, file: string = this.filePath): ResolveResult {
    return this.getResolver().resolve(name, file);
  }

  /**
   * 批量解析多个变量
   */
  resolveMany(names: string[], file: string = this.filePath) {
    return this.getResolver().resolveMany(names, file);
  }
}
