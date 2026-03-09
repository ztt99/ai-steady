import ts from "typescript";
import { ScopeType, VarState } from "../../types/report";

class Scope {
  type: ScopeType;
  parent?: Scope;
  private variables = new Map<string, VarState>(); //存变量名是否使用

  constructor(type: ScopeType, parent?: Scope) {
    this.type = type;
    this.parent = parent;
  }

  //声明时
  declare(name: string, kind: VarState) {
    this.variables.set(name, kind);
  }
  // 使用时
  resolve(name: string): VarState | undefined {
    if (this.variables.has(name)) {
      return this.variables.get(name);
    }
    return this.parent?.resolve(name);
  }

  isFunctionScope(): boolean {
    return this.type === "function" || this.type === "global";
  }
}

export { Scope };
