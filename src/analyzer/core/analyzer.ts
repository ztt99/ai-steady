import ts from "typescript";
import fs from "fs";
import { AnalyzerContext } from "./context";

// plugins
import { ScopePlugin } from "../passes/declaration/scopePlugin";
import { BindingPlugin } from "../passes/declaration/bindingPlugin";
import { ExportPlugin } from "../passes/declaration/exportPlugin";
import { ReferencePlugin } from "../passes/reference/referencePlugin";
import { CallGraphPlugin } from "../passes/reference/callGraphPlugin";
import { HoistedPlugin } from "../passes/declaration/hoistedPlugin";

export interface AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext): void;
  exit(node: ts.Node, ctx: AnalyzerContext): void;
  beforeChildren?: (node: ts.Node, ctx: AnalyzerContext) => void;
}

export function analyzeFile(filePath: string) {
  const code = fs.readFileSync(filePath, "utf-8");

  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);

  const ctx = new AnalyzerContext(filePath, sourceFile);

  const prePlugins: AnalyzerPlugin[] = [new ScopePlugin(), new HoistedPlugin()];

  const plugins: AnalyzerPlugin[] = [
    new BindingPlugin(),
    // new ExportPlugin(),
    // new ReferencePlugin(),
    // new CallGraphPlugin(),
  ];

  traverse(sourceFile, prePlugins, ctx);
  traverse(sourceFile, plugins, ctx);
  return ctx;

  function traverse(node: ts.Node, plugins: AnalyzerPlugin[], ctx: AnalyzerContext) {
    function visit(node: ts.Node) {
      // 1️⃣ enter（声明、入栈）
      for (const p of plugins) p.enter?.(node, ctx);

      // 2️⃣ beforeChildren（hoisting / 初始化准备）
      // for (const p of plugins) p.beforeChildren?.(node, ctx);

      // 3️⃣ DFS
      ts.forEachChild(node, visit);

      // 4️⃣ exit（收尾 / graph / pop）
      for (const p of plugins) p.exit?.(node, ctx);
    }

    visit(node);
  }
}
