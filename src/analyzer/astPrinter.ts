import ts from "typescript";

export function printAST(fileCode: string) {
  const sourceFile = ts.createSourceFile("file.ts", fileCode, ts.ScriptTarget.Latest, true);

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

printAST(`function add(a: number, b: number) {
  return a + b;
}`);
