import ts from "typescript";
import fs from "fs";
import { FileReport } from "../types/report";
import { rules } from "./rules";
import { Scope } from "./scope/scope";
import Reference from "./reference/reference";
import { printScopeTree } from "./scopePrinter";
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

  currentScope = new Scope("global");

  currentScope.declare("console", "builtin");

  collectHoistedDeclarations(sourceFile, currentScope);

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
      currentScope = new Scope("function", previousScope);
      if (node.body && ts.isBlock(node.body)) {
        // 箭头函数 body 不是 block, 表达式函数没有 hoisting 需求。
        collectHoistedDeclarations(node.body, currentScope);
      }
      //  处理参数声明
      node.parameters.forEach((param) => {
        if (ts.isIdentifier(param.name)) {
          currentScope.declare(param.name.text, "param");
        }
      });
      if (ts.isFunctionDeclaration(node) && node.name) {
        previousScope.declare(node.name.text, "function");
      }

      if (ts.isFunctionExpression(node) && node.name) {
        currentScope.declare(node.name.text, "function");
      }

      ts.forEachChild(node, visit);

      // 恢复作用域 pop
      currentScope = previousScope;
      return;
    }

    if (ts.isBlock(node)) {
      const parent = node.parent;
      // 如果是函数的 body 那么不给创建块作用域
      if (parent && isFunctionWithBody(parent) && parent.body === node) {
        ts.forEachChild(node, visit);
        return;
      }

      const previousScope = currentScope;
      currentScope = new Scope("block", previousScope);
      ts.forEachChild(node, visit);
      currentScope = previousScope;
      return;
    }

    // 如果是声明，这时候将变量提升的状态修改
    if (ts.isVariableDeclaration(node)) {
      variableCount++;
      // 收集声明
      if (ts.isIdentifier(node.name)) {
        const text = node.name.text;
        const declarationList = node.parent;

        if (getVariableKind(declarationList) === "var") {
          let scope = currentScope;
          while (scope.parent && !scope.isFunctionScope()) {
            scope = scope.parent;
          }

          const bindings = scope.resolve(text);
          bindings?.initialize();
        } else {
          // 如果是 let const
          const bindings = currentScope.resolve(text);
          bindings?.initialize();
        }
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
      // import fs from 'fs
      if (ts.isImportClause(node.parent) && node.parent.name === node) {
        return;
      }
      // console.log(node);

      /**
       * console 是identifier，log 也是。
       * 他们的parent是一个PropertyAccessExpression
       * node.parent.name 是 log 所以node.parent.name === node不成立
       */

      const name = node.text;

      const binding = currentScope.resolve(name);

      binding?.references.push(new Reference(name, node, currentScope, binding));
      console.log(binding?.references.length, currentScope.type);
      if (!binding) {
        report(node, `${name} is not defined`);
      }
      if (binding?.state === "hoisted") {
        report(node, `${name} is undefined`);
      }

      if (binding?.state === "uninitialized") {
        report(node, `${name} is TDZ`);
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
  // printScopeTree(currentScope, sourceFile);

  return {
    filePath,
    functionCount,
    variableCount,
    importCount,
    hasConsoleLog,
    // report,
  };
}

function getVariableKind(node: ts.Node) {
  if (node.flags & ts.NodeFlags.Const) {
    return "const";
  }

  if (node.flags & ts.NodeFlags.Let) {
    return "let";
  }

  return "var";
}
// 处理 函数作用域内的变量提升
function collectHoistedDeclarations(node: ts.Block | ts.SourceFile, currentScope: Scope) {
  function walkStatement(node: ts.Node) {
    if (currentScope.type === "global") {
      if (ts.isFunctionDeclaration(node) && node.name) {
        currentScope.declare(node.name.text, "function");
        return;
      }
    }
    // 函数声明 return，因为外部有保存 scope 的地方，这里在保存，会重复
    // 阻止进入 function 作用域边界，永远递归只在 function 边界 return
    if (
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isFunctionDeclaration(node)
    ) {
      return;
    }

    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;

      if (!clause) return;

      // default import
      if (clause.name) {
        currentScope.declare(clause.name.text, "import");
      }
      // named imports
      if (clause.namedBindings) {
        if (ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            currentScope.declare(element.name.text, "import");
          }
        }

        if (ts.isNamespaceImport(clause.namedBindings)) {
          currentScope.declare(clause.namedBindings.name.text, "import");
        }
      }
      return;
    }
    // var 是变量提升 但是不赋值
    if (ts.isVariableStatement(node)) {
      if (getVariableKind(node.declarationList) === "var") {
        for (let decl of node.declarationList.declarations) {
          collectBindingNames(decl.name, (name) => {
            currentScope.declare(name, "var");
          });
        }
      } else {
        // let const
        for (let decl of node.declarationList.declarations) {
          collectBindingNames(decl.name, (name) => {
            currentScope.declare(name, getVariableKind(node.declarationList));
          });
        }
      }

      return;
    }
  }

  function collectBindingNames(name: ts.BindingName, cb: (name: string) => void) {
    if (ts.isIdentifier(name)) {
      cb(name.text);
    } else {
      for (let element of name.elements) {
        if (ts.isOmittedExpression(element)) continue;
        collectBindingNames(element.name, cb);
      }
    }
  }

  ts.forEachChild(node, walkStatement);
}

function isFunctionWithBody(
  node: ts.Node,
): node is
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}
