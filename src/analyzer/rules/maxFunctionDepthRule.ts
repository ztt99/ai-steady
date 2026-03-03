import ts from "typescript";
import { Rule } from "../../types/report";

const maxFunctionDepthRule: Rule = {
  name: "max-function-depth",
  create(context) {
    let depth = 0;
    return {
      enter(node) {
        const isFun =
          ts.isMethodDeclaration(node) ||
          ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node) ||
          ts.isClassDeclaration(node);
        if (isFun) {
          depth++;
          if (depth > 2) {
            context.report(`Function depth exceeds maximum allowed depth of 2`, node);
          }
        }
      },
      exit(node) {
        const isFun = ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node);
        if (isFun) {
          depth--;
        }
      },
    };
  },
};

export { maxFunctionDepthRule };
