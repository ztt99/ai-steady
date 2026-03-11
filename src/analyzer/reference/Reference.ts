import ts from "typescript";
import { Scope } from "../scope/scope";
import { Binding } from "../binding/Binding";

class Reference {
  name: string;
  identifier: ts.Identifier; // AST 节点
  fromScope: Scope;
  resolvedBinding?: Binding | null; // 可能未声明

  constructor(
    name: string,
    identifier: ts.Identifier,
    fromScope: Scope,
    resolvedBinding?: Binding | null,
  ) {
    this.name = name;
    this.identifier = identifier;
    this.fromScope = fromScope;
    this.resolvedBinding = resolvedBinding;
  }
}
export default Reference;
