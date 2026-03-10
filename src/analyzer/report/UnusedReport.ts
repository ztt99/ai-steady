import { Binding } from "../binding/Binding";
import { Scope } from "../scope/scope";

class UnusedReport {
  name: string;
  kind: Binding["kind"];
  line: number;
  column: number;
  scopeType: Scope["type"];
  constructor(
    name: string,
    kind: Binding["kind"],
    line: number,
    column: number,
    scopeType: Scope["type"],
  ) {
    this.name = name;
    this.kind = kind;
    this.line = line;
    this.column = column;
    this.scopeType = scopeType;
  }
}

export { UnusedReport };
