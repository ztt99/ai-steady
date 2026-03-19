import ts from "typescript";
import { Scope } from "../scope/scope";
import { Binding } from "../binding/Binding";
import Reference from "../reference/reference";
import { ModuleGraph } from "../graph/module/moduleGraph";
import { SymbolGraph } from "../graph/symbol/symbolGraph";

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
  moduleGraph = new ModuleGraph();

  constructor(filePath: string, sourceFile: ts.SourceFile) {
    this.filePath = filePath;
    this.sourceFile = sourceFile;

    this.currentScope = new Scope("global");
  }

  pushScope(type: "function" | "block") {
    this.currentScope = new Scope(type, this.currentScope);
  }

  popScope() {
    if (this.currentScope.parent) {
      this.currentScope = this.currentScope.parent;
    }
  }
}
