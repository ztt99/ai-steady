import ts from "typescript";
import fs from "fs";
import { FileReport } from "../types/report";
import { rules } from "./rules";
import { Scope } from "./scope/scope";
export function analyzeFile(filePath: string): FileReport {
  const fileContent = fs.readFileSync(filePath, "utf-8");

  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const ruleInstances = rules.map((rule) =>
    rule.create({ sourceFile, report: (message, node) => report(node, message) }),
  );

  let functionCount = 0;
  let variableCount = 0;
  let importCount = 0;
  let hasConsoleLog = false;
  let currentScope: Scope;

  currentScope = new Scope();

  currentScope.declare("console");

  function report(node: ts.Node, message: string) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    console.log(`[no-undef] (${line + 1}:${character + 1}) ${message}`);
  }

  function visit(node: ts.Node) {
    ruleInstances.forEach((rule) => {
      rule.enter(node);
    });

    if (
      ts.isMethodDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      functionCount++;

      const previousScope = currentScope;
      // 创建新作用域，并将previousScope作用域传递  push
      currentScope = new Scope(previousScope);
      //  处理参数声明
      node.parameters.forEach((param) => {
        if (ts.isIdentifier(param.name)) {
          currentScope.declare(param.name.text);
        }
      });

      if (ts.isFunctionDeclaration(node) && node.name) {
        previousScope.declare(node.name.text);
      }

      ts.forEachChild(node, visit);
      // 恢复作用域 pop
      currentScope = previousScope;
      return;
    }

    if (ts.isVariableDeclaration(node)) {
      variableCount++;
      // 收集声明
      if (ts.isIdentifier(node.name)) {
        currentScope.declare(node.name.text);
      }
    }

    if (ts.isIdentifier(node)) {
      // node当前节点是 identifier，需要找他的父亲
      if (ts.isVariableDeclaration(node.parent) && node.parent.name === node) {
        return;
      }

      // 如果是参数
      if (ts.isParameter(node.parent) && node.parent.name === node) {
        return;
      }
      // 如果是函数声明
      if (ts.isFunctionDeclaration(node.parent) && node.parent.name === node) {
        return;
      }
      // 如果是类声明
      if (ts.isClassDeclaration(node.parent) && node.parent.name === node) {
        return;
      }
      // 如果是属性访问
      if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) {
        return;
      }
      // console.log(node);

      /**
       * console 是identifier，log 也是。
       * 他们的parent是一个PropertyAccessExpression
       * node.parent.name 是 log 所以node.parent.name === node不成立
       */

      const name = node.text;
      if (!currentScope.resolve(name)) {
        report(node, `${name} is not defined`);
      }
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

    ruleInstances.forEach((rule) => {
      rule.exit(node);
    });
  }

  visit(sourceFile);
  // console.log(report);

  return {
    filePath,
    functionCount,
    variableCount,
    importCount,
    hasConsoleLog,
    // report,
  };
}
