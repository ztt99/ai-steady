// import ts from "typescript";

// // 语法级解析，没有类型信息，适合结构分析、代码扫描、简单规则检查
// const sourceFile = ts.createSourceFile("example.ts", "const x = 42;", ts.ScriptTarget.Latest, true);

// // 语义级分析，获取变量类型、获取接口定义、分析 import 依赖
// // ts.createProgram
// function visit(node: ts.Node) {
//   console.log(ts.SyntaxKind[node.kind]);
//   ts.forEachChild(node, visit);
// }

// visit(sourceFile);

// function a() {
//   function b() {
//     function c() {
//       // ❌ 超过 2 层
//     }
//   }
// }

// export {};
