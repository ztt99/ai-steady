import ts from "typescript";
import { BindKind } from "../../types/binding";
import { VarState } from "../../types/report";
import { Scope } from "../scope/scope";
import Reference from "../reference/Reference";

class Binding {
  name: string;
  kind: BindKind;
  scope: Scope;
  references: Reference[];
  state: VarState;
  identifier: ts.Node | undefined;
  shadowed: Binding | undefined;
  used: boolean = false;

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
