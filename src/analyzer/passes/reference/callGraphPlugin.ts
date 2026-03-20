import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";

export class CallGraphPlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    if (!ts.isCallExpression(node)) return;

    const expr = node.expression;

    if (ts.isIdentifier(expr)) {
      const callee = ctx.getScope(node).resolve(expr.text);

      if (ctx.currentFunctionBinding && callee) {
        ctx.symbolGraph.addEdge(ctx.currentFunctionBinding, callee, "call");
      }
    }
  }

  exit() {}
}
