import ts from "typescript";
import { Binding } from "../analyzer/binding/Binding";
import { Scope } from "../analyzer/scope/scope";

export interface FileReport {
  filePath: string;
  functionCount: number;
  variableCount: number;
  importCount: number;
  hasConsoleLog: boolean;
  walkReport: UnusedReport[];
}

export interface ProjectReport {
  totalFiles: number;
  totalFunctions: number;
  totalVariables: number;
  totalImports: number;
  filesWithConsole: string[];
}

interface RuleContext {
  sourceFile: ts.SourceFile;
  report: (message: string, node: ts.Node) => void;
}

export interface Rule {
  name: string;
  // check(node: ts.Node, sourceFile: ts.SourceFile): string | null;
  create(context: RuleContext): {
    enter(node: ts.Node): void;
    exit(node: ts.Node): void;
  };
}

export type ScopeType = "global" | "function" | "block";

export type VarState = "hoisted" | "uninitialized" | "initialized";

export interface UnusedReport {
  name: string;
  kind: Binding["kind"];
  line: number;
  column: number;
  scopeType: Scope["type"];
}
