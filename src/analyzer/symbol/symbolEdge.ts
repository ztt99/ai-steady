import { Binding } from "../binding/Binding";

export type EdgeType = "dependency" | "call" | "reference";

export class SymbolEdge {
  from: Binding;
  to: Binding;
  type: EdgeType;

  constructor(from: Binding, to: Binding, type: EdgeType) {
    this.from = from;
    this.to = to;
    this.type = type;
  }
}
