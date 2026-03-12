import { Binding } from "../binding/Binding";
import { DependencyGraph } from "./dependencyGraph";

class ImpactAnalyzer {
  constructor(private graphEngine: DependencyGraph) {}
  getImpactedBindings(start: Binding): Set<Binding> {
    const visited = new Set<Binding>();
    const stack: Binding[] = [start];

    while (stack.length) {
      const current = stack.pop();
      if (!current || visited.has(current)) {
        continue;
      }

      visited.add(current);
      const dependents = this.graphEngine.getDependents(current);

      for (const dependent of dependents) {
        if (!visited.has(dependent)) {
          stack.push(dependent);
        }
      }
    }
    return visited;
  }
}

export { ImpactAnalyzer };
