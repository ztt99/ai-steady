import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";

export class BindingPlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    // function declaration
    if (ts.isFunctionDeclaration(node) && node.name) {
      ctx.currentScope.declare(node.name.text, "function", node);
    }

    // variable
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      ctx.currentScope.declare(node.name.text, "var", node);
    }

    // params
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      ctx.currentScope.declare(node.name.text, "param", node);
    }
  }

  exit() {}
}
