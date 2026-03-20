import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";

export class SymbolGraphPlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    if (!ts.isIdentifier(node)) return;

    const binding = ctx.getScope(node).resolve(node.text);

    if (ctx.currentBinding && binding) {
      ctx.symbolGraph.addEdge(ctx.currentBinding, binding, "dependency");
    }
  }
  exit(node: ts.Node, ctx: AnalyzerContext): void {}
}
