import { Binding } from "../binding/Binding";
import { GraphEngine } from "./graph";

export class DependencyGraph {
  edges = new GraphEngine();

  addDependency(from: Binding, to: Binding) {
    this.edges.addDependency(from, to);
  }

  getDependencies(from: Binding): Set<Binding> | undefined {
    return this.edges.getDependencies(from);
  }

  getDependents(to: Binding): Set<Binding> {
    return this.edges.getDependents(to);
  }

  print() {
    for (const [from, deps] of this.edges.edges) {
      const names = [...deps].map((d) => d.name);
      console.log(from.name, "->", names.join(", "));
    }
  }
}
