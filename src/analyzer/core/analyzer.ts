import ts from "typescript";
import fs from "fs";
import { AnalyzerContext } from "./context";

// plugins
import { ScopePlugin } from "../passes/declaration/scopePlugin";
import { BindingPlugin } from "../passes/declaration/bindingPlugin";
import { ExportPlugin } from "../passes/declaration/exportPlugin";
import { ReferencePlugin } from "../passes/reference/referencePlugin";
import { CallGraphPlugin } from "../passes/reference/callGraphPlugin";

export interface AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext): void;
  exit(node: ts.Node, ctx: AnalyzerContext): void;
}

export function analyzeFile(filePath: string) {
  const code = fs.readFileSync(filePath, "utf-8");

  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);

  const ctx = new AnalyzerContext(filePath, sourceFile);

  const plugins: AnalyzerPlugin[] = [
    new ScopePlugin(),
    new BindingPlugin(),
    new ExportPlugin(),
    new ReferencePlugin(),
    new CallGraphPlugin(),
  ];

  function visit(node: ts.Node) {
    for (const p of plugins) p.enter(node, ctx);

    ts.forEachChild(node, visit);

    for (const p of plugins) p.exit(node, ctx);
  }

  visit(sourceFile);

  return ctx;
}
