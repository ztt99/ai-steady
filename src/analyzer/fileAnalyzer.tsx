import ts, { isVariableDeclaration } from "typescript";
import fs from "fs";
import { FileReport } from "../types/report";
import { rules } from "./rules";
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
  let report: string[] = [];

  function visit(node: ts.Node) {
    rules.forEach((rule) => {
      const result = rule.check(node, sourceFile);
      if (result) {
        report.push(result);
      }
    });

    if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
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
          hasConsoleLog = true;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  console.log(report);

  return {
    filePath,
    functionCount,
    variableCount,
    importCount,
    hasConsoleLog,
    // report,
  };
}
