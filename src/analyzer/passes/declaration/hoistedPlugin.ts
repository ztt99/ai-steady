import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";
import { collectBindingNames, getVariableKind, isFunctionBody } from "../../utils";

export class HoistedPlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    const walkStatement = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        let scope = ctx.currentScope;
        while (scope.parent && !scope.isFunctionScope()) {
          scope = scope.parent;
        }
        scope.declare(node.name.text, "function", node);
        return;
      }

      if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
        ctx.currentScope.declare(node.name.text, "param", node);
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
          ctx.currentScope.declare(clause.name.text, "import", node);
        }
        // named imports
        if (clause.namedBindings) {
          if (ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) {
              ctx.currentScope.declare(element.name.text, "import", element);
            }
          }

          if (ts.isNamespaceImport(clause.namedBindings)) {
            ctx.currentScope.declare(clause.namedBindings.name.text, "import", node);
          }
        }

        return;
      }
      // var 是变量提升 但是不赋值
      if (ts.isVariableStatement(node)) {
        if (getVariableKind(node.declarationList) === "var") {
          for (let decl of node.declarationList.declarations) {
            collectBindingNames(decl.name, (name) => {
              let scope = ctx.currentScope;
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
              ctx.currentScope.declare(name, getVariableKind(node.declarationList), decl);
            });
          }
        }

        return;
      }
    };

    ts.forEachChild(node, walkStatement);
  }

  exit(node: ts.Node, ctx: AnalyzerContext) {}
}
