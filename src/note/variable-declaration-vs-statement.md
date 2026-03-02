# TypeScript AST 变量统计总结

## 核心区别

- `ts.isVariableDeclaration(node)`：判断**单个变量声明项**（`VariableDeclaration`）。
- `ts.isVariableStatement(node)`：判断**整条变量语句**（`VariableStatement`）。

## 两种写法对比

当前写法：

```ts
if (ts.isVariableDeclaration(node)) {
  variableCount++;
}
```

含义：每遇到一个声明项就加 1。

可替代写法：

```ts
if (ts.isVariableStatement(node)) {
  variableCount += node.declarationList.declarations.length;
}
```

含义：在变量语句层面统计，再累加这条语句里的声明项数量。

## 行为差异（重点）

- 对于 `const a = 1, b = 2;`，两者都统计为 2。
- 对于 `for (let i = 0; i < 10; i++) {}`：
  - `isVariableDeclaration` 会统计到 `i`。
  - `isVariableStatement` 不会统计到（因为不属于变量语句节点）。

## 建议

如果目标是“统计所有变量声明项”，保留当前的 `isVariableDeclaration` 写法更稳妥。

## 附加说明

在 `src/analyzer/fileAnalyzer.tsx` 顶部：

```ts
import ts, { isVariableDeclaration } from "typescript";
```

其中解构出的 `isVariableDeclaration` 未直接使用（代码中使用的是 `ts.isVariableDeclaration`），可改为：

```ts
import ts from "typescript";
```
