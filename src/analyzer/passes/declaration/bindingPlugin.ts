import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";
import { getVariableKind } from "../../utils";

export class BindingPlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    console.log(ts.SyntaxKind[node.kind]);

    let nNode = node;
    let scope = ctx.scopeMap.get(nNode);
    while (!scope) {
      nNode = nNode.parent;
      scope = ctx.scopeMap.get(nNode);
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      const kind = getVariableKind(node.parent);

      let binding;

      if (kind === "var") {
        let targetScope = scope;
        while (targetScope.parent && !targetScope.isFunctionScope()) {
          targetScope = targetScope.parent;
        }
        binding = targetScope.resolve(name);
      } else {
        binding = scope.resolve(name);
      }

      binding?.initialize();
      ctx.currentBinding = binding;
    }
  }

  exit(node: ts.Node, ctx: AnalyzerContext) {
    if (ts.isVariableDeclaration(node)) {
      // const binding = ctx.currentBinding;
      // ctx.currentBinding = undefined;
    }
  }
}
