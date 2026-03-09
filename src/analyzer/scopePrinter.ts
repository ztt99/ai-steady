import ts from "typescript";
import { Scope } from "./scope/scope";
import { Binding } from "./binding/Binding";
import Reference from "./reference/reference";

/**
 * 打印整个 Scope Tree
 */
export function printScopeTree(scope: Scope, sourceFile: ts.SourceFile) {
  printScope(scope, sourceFile, 0);
}

/**
 * 打印单个 Scope
 */
function printScope(scope: Scope, sourceFile: ts.SourceFile, indent: number) {
  const space = " ".repeat(indent);

  console.log(`${space}Scope(${scope.type})`);

  // 打印 bindings
  const bindings = getBindings(scope);

  for (const binding of bindings) {
    printBinding(binding, sourceFile, indent + 2);
  }

  // 递归 children
  for (const child of scope.children ?? []) {
    printScope(child, sourceFile, indent + 2);
  }
}

/**
 * 打印 Binding
 */
function printBinding(binding: Binding, sourceFile: ts.SourceFile, indent: number) {
  const space = " ".repeat(indent);

  const refs = binding.references ?? [];
  const refsCount = refs.length;

  console.log(`${space}${binding.name} (${binding.kind}) state=${binding.state} refs=${refsCount}`);

  for (const ref of refs) {
    printReference(ref, sourceFile, indent + 2);
  }
}

/**
 * 打印 Reference
 */
function printReference(reference: Reference, sourceFile: ts.SourceFile, indent: number) {
  const space = " ".repeat(indent);

  const pos = sourceFile.getLineAndCharacterOfPosition(reference.identifier.getStart());

  const line = pos.line + 1;
  const col = pos.character + 1;

  console.log(`${space}ref -> ${reference.name} (line:${line}, col:${col})`);
}

/**
 * 获取 Scope 的 bindings
 * （因为你的 bindings 是 private）
 */
function getBindings(scope: any): Binding[] {
  if (scope.bindings instanceof Map) {
    return Array.from(scope.bindings.values());
  }

  if (scope.variables instanceof Map) {
    return Array.from(scope.variables.values());
  }

  return [];
}
