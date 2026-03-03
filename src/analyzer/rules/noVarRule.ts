import ts from "typescript";
import { Rule } from "../../types/report";

const noVarRule: Rule = {
  name: "no-var",
  check(node, sourceFile) {
    if (ts.isVariableDeclaration(node)) {
      const { name } = node;
      if (ts.isIdentifier(name) && name.text === "var") {
        return `Unexpected var statement at ${sourceFile.fileName}:${node.getStart()}`;
      }
    }
    return null;
  },
};

export { noVarRule };
