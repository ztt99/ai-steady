import ts from "typescript";

class Scope {
  parent?: Scope;
  private variables = new Set<string>(); //存变量名是否使用

  constructor(parent?: Scope) {
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
}

export { Scope };
