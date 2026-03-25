import ts from "typescript";
import { BindKind } from "../../types/binding";
import { VarState } from "../../types/report";
import { Scope } from "../scope/scope";
import Reference from "../reference/reference";

class Binding {
  name: string;
  kind: BindKind;
  scope: Scope;
  references: Reference[];
  state: VarState;
  identifier: ts.Node | undefined;
  shadowed: Binding | undefined;
  used: boolean = false;

  /** 导出源 binding（用于 import 的实时绑定） */
  exportSource?: Binding;
  /** 被哪些 binding 导入（反向链接） */
  importedBy: Binding[] = [];
  /** 所在模块路径 */
  moduleId?: string;

  constructor(name: string, kind: BindKind, scope: Scope, references: Reference[]) {
    this.name = name;
    this.kind = kind;
    this.scope = scope;
    this.references = references;
    this.state = "uninitialized";
  }

  initialize() {
    if (this.state !== "initialized") {
      this.state = "initialized";
    }
  }

  createState(kind: BindKind) {
    switch (kind) {
      case "var":
        this.state = "hoisted";
        break;
      case "let":
      case "const":
        this.state = "uninitialized";
        break;
      case "import":
      case "param":
      case "function":
      case "builtin":
        this.state = "initialized";
    }
  }
}

export { Binding };
