// import ts from "typescript";
// import { Rule } from "../../types/report";

// const noConsoleRule: Rule = {
//   name: "no-console",
//   check(node, sourceFile) {
//     if (ts.isCallExpression(node)) {
//       const expression = node.expression;
//       if (ts.isPropertyAccessExpression(expression)) {
//         const { expression: obj, name: method } = expression;
//         //isIdentifier判断是不是标识符  一个变量名 / 函数名 / 属性名 / 参数名
//         if (ts.isIdentifier(obj) && obj.text === "console" && method.text === "log") {
//           return `Unexpected console statement at ${sourceFile.fileName}:${node.getStart()}`;
//         }
//       }
//     }
//     return null;
//   },
// };

// export { noConsoleRule };
