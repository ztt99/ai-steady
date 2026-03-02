import ts, { isVariableDeclaration } from "typescript";
import fs from "fs";
import { FileReport } from "../types/report";

export function analyzeFile(filePath: string): FileReport {
  const fileContent = fs.readFileSync(filePath, "utf-8");

  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  let functionCount = 0;
  let variableCount = 0;
  let importCount = 0;
  let hasConsoleLog = false;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node)) {
      functionCount++;
    }
    // 箭头函数也需要计入
    if (ts.isArrowFunction(node)) {
      functionCount++;
    }

    if (ts.isVariableDeclaration(node)) {
      variableCount++;
    }

    if (ts.isImportDeclaration(node)) {
      importCount++;
    }

    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isPropertyAccessExpression(expression)) {
        const { expression: obj, name: method } = expression;
        if (ts.isIdentifier(obj) && obj.text === "console" && method.text === "log") {
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    filePath: filePath,
    functionCount: functionCount,
    variableCount: variableCount,
    importCount: importCount,
    hasConsoleLog: hasConsoleLog,
  };
}

// 统计analyzeFile 返回的数量

function summarizeAnalysisResults(results: ReturnType<typeof analyzeFile>[]) {
  let totalFunctions = 0;
  let totalVariables = 0;
  let totalImports = 0;
  let totalConsoleLogs = 0;
  let totalFiles = 0;

  for (const result of results) {
    totalFunctions += result.functionCount;
    totalVariables += result.variableCount;
    totalImports += result.importCount;
    totalConsoleLogs += result.hasConsoleLog ? 1 : 0;
    totalFiles++;
  }

  return {
    totalFiles,
    totalFunctions,
    totalVariables,
    totalImports,
    totalConsoleLogs,
  };
}
