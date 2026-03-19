import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";
import Reference from "../../reference/reference";

export class ReferencePlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    if (!ts.isIdentifier(node)) return;

    const parent = node.parent;

    // 排除声明位置
    if (
      (ts.isVariableDeclaration(parent) && parent.name === node) ||
      (ts.isFunctionDeclaration(parent) && parent.name === node) ||
      (ts.isParameter(parent) && parent.name === node)
    ) {
      return;
    }

    const name = node.text;
    const binding = ctx.currentScope.resolve(name);

    const ref = new Reference(name, node, ctx.currentScope, binding ?? null);

    ctx.references.push(ref);

    if (binding) {
      binding.references.push(ref);
    }

    if (ctx.currentBinding && binding) {
      ctx.symbolGraph.addEdge(ctx.currentBinding, binding, "dependency");
    }
  }

  exit(node: ts.Node, ctx: AnalyzerContext) {
    if (ts.isIdentifier(node)) console.log(ctx.currentScope.resolve(node.text));
  }
}
