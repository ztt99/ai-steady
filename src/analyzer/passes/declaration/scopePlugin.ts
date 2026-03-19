import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";

export class ScopePlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      ctx.pushScope("function");
    }

    if (ts.isBlock(node)) {
      const parent = node.parent;

      const isFunctionBody =
        parent &&
        (ts.isFunctionDeclaration(parent) ||
          ts.isFunctionExpression(parent) ||
          ts.isArrowFunction(parent)) &&
        parent.body === node;

      if (!isFunctionBody) {
        ctx.pushScope("block");
      }
    }
  }

  exit(node: ts.Node, ctx: AnalyzerContext) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isBlock(node)
    ) {
      ctx.popScope();
    }
  }
}
