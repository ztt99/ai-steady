// import ts from "typescript";
// import { Rule } from "../../types/report";

// const noVarRule: Rule = {
//   name: "no-var",
//   create(context) {
//     // 每个规则实例拥有自己的私有状态
//     // 把系统运行时信息集中管理，而不是散落在参数列表里。
//     // 生命周期
//     return {
//       enter(node: ts.Node) {
//         if (ts.isVariableDeclarationList(node)) {
//           if (node.flags === 0) {
//             context.report(`Unexpected var statement at ${context.sourceFile.fileName}:${node.getStart()}`, node);
//           }
//         }
//       },
//     };
//   },
// };

// export { noVarRule };
