import ts from "typescript";

export function getVariableKind(node: ts.Node) {
  if (node.flags & ts.NodeFlags.Const) {
    return "const";
  }

  if (node.flags & ts.NodeFlags.Let) {
    return "let";
  }

  return "var";
}

export function collectBindingNames(name: ts.BindingName, cb: (name: string) => void) {
  if (ts.isIdentifier(name)) {
    cb(name.text);
  } else {
    for (let element of name.elements) {
      if (ts.isOmittedExpression(element)) continue;
      collectBindingNames(element.name, cb);
    }
  }
}

export function isFunctionBody(node: ts.Node) {
  const parent = node.parent;

  return (
    parent &&
    (ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isArrowFunction(parent)) &&
    parent.body === node
  );
}
