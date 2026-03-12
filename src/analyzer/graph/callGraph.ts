import { Binding } from "../binding/Binding";
import { GraphEngine } from "./graph";

class CallGraph {
  edges = new GraphEngine();

  addCall(form: Binding, to: Binding) {
    this.edges.addDependency(form, to);
  }
  getCallees(form: Binding) {
    return this.edges.getDependencies(form);
  }

  print() {
    for (const [caller, callees] of this.edges.edges) {
      console.log(caller.name, "->", [...callees].map((c) => c.name).join(", "));
    }
  }
}

export { CallGraph };
