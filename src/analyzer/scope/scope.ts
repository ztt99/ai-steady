import ts from "typescript";
import { ScopeType } from "../../types/report";

class Scope {
  type: ScopeType;
  parent?: Scope;
  private variables = new Set<string>(); //存变量名是否使用

  constructor(type: ScopeType, parent?: Scope) {
    this.type = type;
    this.parent = parent;
  }

  //声明时
  declare(name: string) {
    this.variables.add(name);
  }
  // 使用时
  resolve(name: string): boolean {
    if (this.variables.has(name)) {
      return true;
    } else if (this.parent) {
      return this.parent.resolve(name);
    } else {
      return false;
    }
  }

  isFunctionScope(): boolean {
    return this.type === "function" || this.type === "global";
  }
}

export { Scope };
