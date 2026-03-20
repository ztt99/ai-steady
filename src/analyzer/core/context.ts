import ts from "typescript";
import { Scope } from "../scope/scope";
import { Binding } from "../binding/Binding";
import Reference from "../reference/reference";
import { ModuleGraph } from "../graph/module/moduleGraph";
import { SymbolGraph } from "../graph/symbol/symbolGraph";
import { collectBindingNames, getVariableKind } from "../utils";

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

  scopeMap = new Map();
  constructor(filePath: string, sourceFile: ts.SourceFile) {
    this.filePath = filePath;
    this.sourceFile = sourceFile;

    this.currentScope = new Scope("global");
    this.scopeMap.set(sourceFile, this.currentScope);
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

  collectHoisted(node: ts.Node) {
    const walkStatement = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        let scope = this.currentScope;
        while (scope.parent && !scope.isFunctionScope()) {
          scope = scope.parent;
        }
        scope.declare(node.name.text, "function", node);
        return;
      }

      if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
        this.currentScope.declare(node.name.text, "param", node);
        return;
      }
      // 函数声明 return，因为外部有保存 scope 的地方，这里在保存，会重复
      // 阻止进入 function 作用域边界，永远递归只在 function 边界 return
      if (
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isFunctionDeclaration(node)
      ) {
        return;
      }

      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        if (!clause) return;

        // default import
        if (clause.name) {
          this.currentScope.declare(clause.name.text, "import", node);
        }
        // named imports
        if (clause.namedBindings) {
          if (ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) {
              this.currentScope.declare(element.name.text, "import", element);
            }
          }

          if (ts.isNamespaceImport(clause.namedBindings)) {
            this.currentScope.declare(clause.namedBindings.name.text, "import", node);
          }
        }

        return;
      }
      // var 是变量提升 但是不赋值
      if (ts.isVariableStatement(node)) {
        if (getVariableKind(node.declarationList) === "var") {
          for (let decl of node.declarationList.declarations) {
            collectBindingNames(decl.name, (name) => {
              let scope = this.currentScope;
              while (scope.parent && !scope.isFunctionScope()) {
                scope = scope.parent;
              }
              scope.declare(name, "var", decl);
            });
          }
        } else {
          // let const
          for (let decl of node.declarationList.declarations) {
            collectBindingNames(decl.name, (name) => {
              this.currentScope.declare(name, getVariableKind(node.declarationList), decl);
            });
          }
        }

        return;
      }
      // ts.forEachChild(node, walkStatement);
    };

    ts.forEachChild(node, walkStatement);
  }
}
