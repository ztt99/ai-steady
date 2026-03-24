import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";

export class ImportLinker implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext): void {
    if (!ts.isIdentifier(node)) return;
  }

  exit(_node: ts.Node, _ctx: AnalyzerContext): void {}
}
