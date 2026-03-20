import { Binding } from "../../binding/Binding";
import { EdgeType, SymbolEdge } from "./symbolEdge";
import { SymbolNode } from "./symbolNode";

export class SymbolGraph {
  nodes = new Map<Binding, SymbolNode>();

  edges: SymbolEdge[] = [];
  reverseEdges: SymbolEdge[] = [];

  addNode(binding: Binding) {
    if (!this.nodes.has(binding)) {
      this.nodes.set(binding, new SymbolNode(binding));
    }
  }

  addEdge(from: Binding, to: Binding, type: EdgeType) {
    this.addNode(from);
    this.addNode(to);

    this.edges.push(new SymbolEdge(from, to, type));
    this.reverseEdges.push(new SymbolEdge(to, from, type));
  }
  print() {
    for (let e of this.edges) {
      console.log("dep", e.from.name, "--->", e.to.name);
    }
  }
}
