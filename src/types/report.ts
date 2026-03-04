import ts from "typescript";

export interface FileReport {
  filePath: string;
  functionCount: number;
  variableCount: number;
  importCount: number;
  hasConsoleLog: boolean;
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
