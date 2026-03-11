import ts from "typescript";
import { ScopeType, VarState } from "../../types/report";
import { Binding } from "../binding/Binding";
import { BindKind } from "../../types/binding";
import { checkShadow } from "../report/ShadowDetection";

class Scope {
  type: ScopeType;
  parent?: Scope;
  children?: Scope[];
  bindings = new Map<string, Binding>(); //存变量名是否使用

  constructor(type: ScopeType, parent?: Scope) {
    this.type = type;
    this.parent = parent;
    this.children = [];

    if (this.parent) {
      this.parent.children?.push(this);
    }
  }

  //声明时
  declare(name: string, kind: BindKind, node: ts.Node) {
    const binding = new Binding(name, kind, this, []);

    binding.createState(kind);
    binding.identifier = node;
    this.bindings.set(name, binding);

    const outerBinding = checkShadow(binding);
    binding.shadowed = outerBinding;

    return binding;
  }
  // 使用时
  resolve(name: string): Binding | undefined {
    if (this.bindings.has(name)) {
      return this.bindings.get(name);
    }
    return this.parent?.resolve(name);
  }

  isFunctionScope(): boolean {
    return this.type === "function" || this.type === "global";
  }
}

export { Scope };
