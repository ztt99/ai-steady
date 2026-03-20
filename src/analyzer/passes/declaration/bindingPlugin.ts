import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";
import { getVariableKind } from "../../utils";

export class BindingPlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    let scope = ctx.getScope(node);
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
      const binding = ctx.currentBinding;
      ctx.currentBinding = undefined;
    }
  }
}
