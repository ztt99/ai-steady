import ts from "typescript";
import fs from "fs";
import path from "path";
export function printAST(filePath: string) {
  const fileCode = fs.readFileSync(path.join(process.cwd(), filePath), "utf-8");

  const sourceFile = ts.createSourceFile(
    path.basename(filePath),
    fileCode,
    ts.ScriptTarget.Latest,
    true,
  );

  let str = "";
  function visit(node: ts.Node, depth: number) {
    const nodeName = ts.SyntaxKind[node.kind];
    if (ts.isIdentifier(node)) {
      str += "  ".repeat(depth) + nodeName + ": " + node.text + "\n";
      console.log("  ".repeat(depth) + nodeName + ": " + node.text);
    } else {
      str += "  ".repeat(depth) + nodeName + "\n";
      console.log("  ".repeat(depth) + nodeName);
    }
    ts.forEachChild(node, (child) => visit(child, depth + 1));
  }

  visit(sourceFile, 0);

  return str;
}

printAST("src/note/test.ts");
