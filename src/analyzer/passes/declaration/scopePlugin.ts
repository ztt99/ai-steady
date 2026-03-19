import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";
import { isFunctionBody } from "../../utils";

export class ScopePlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      ctx.pushScope("function");
      ctx.scopeMap.set(node, ctx.currentScope);
    }

    if (ts.isBlock(node)) {
      if (!isFunctionBody(node)) {
        ctx.pushScope("block");
        ctx.scopeMap.set(node, ctx.currentScope);
      }
    }
  }
  beforeChildren(node: ts.Node, ctx: AnalyzerContext) {}

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
