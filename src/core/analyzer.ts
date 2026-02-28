import ts from "typescript";
import fs from "fs";

export function analyzeFile(filePath: string) {
  const sourceCode = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);
  let functionCount = 0;
  let classCount = 0;

  function visit(node: ts.Node) {
    // console.log(ts.SyntaxKind[node.kind]);

    if (ts.isFunctionDeclaration(node)) {
      functionCount++;
    }
    if (ts.isClassDeclaration(node)) {
      classCount++;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    filePath,
    functionCount,
    classCount,
  };
}
