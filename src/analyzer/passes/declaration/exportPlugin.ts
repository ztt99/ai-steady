import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";

export class ExportPlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    const module = ctx.moduleGraph.ensureModule(ctx.filePath);

    if (ts.isFunctionDeclaration(node) && hasExport(node)) {
      const name = node.name?.text;
      if (!name) return;

      const binding = ctx.currentScope.resolve(name);
      if (binding) {
        module.exports.set(name, binding);
      }
    }

    if (ts.isVariableStatement(node) && hasExport(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const binding = ctx.currentScope.resolve(decl.name.text);
          if (binding) {
            module.exports.set(decl.name.text, binding);
          }
        }
      }
    }
  }

  exit() {}
}

function hasExport(node: ts.FunctionDeclaration | ts.VariableStatement) {
  return !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}
