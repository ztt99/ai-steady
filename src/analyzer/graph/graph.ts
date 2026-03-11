import { Binding } from "../binding/Binding";

export class GraphEngine {
  // 依赖关系
  edges: Map<Binding, Set<Binding>> = new Map();

  // 反向依赖
  reverseEdges: Map<Binding, Set<Binding>> = new Map();

  addDependency(from: Binding, to: Binding) {
    if (from === to) return;

    // forward
    if (!this.edges.has(from)) {
      this.edges.set(from, new Set());
    }

    this.edges.get(from)!.add(to);

    // reverse
    if (!this.reverseEdges.has(to)) {
      this.reverseEdges.set(to, new Set());
    }

    this.reverseEdges.get(to)!.add(from);
  }

  getDependencies(binding: Binding) {
    return this.edges.get(binding) ?? new Set();
  }

  getDependents(binding: Binding) {
    return this.reverseEdges.get(binding) ?? new Set();
  }
}
