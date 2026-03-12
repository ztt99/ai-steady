export class ImportGraph {
  edges = new Map<string, Set<string>>();
  addImport(from: string, to: string) {
    if (!this.edges.has(from)) {
      this.edges.set(from, new Set());
    }

    this.edges.get(from)!.add(to);
  }
  getImports(file: string) {
    return this.edges.get(file) ?? new Set();
  }

  print() {
    console.log("\nImport Graph:");

    for (const [from, targets] of this.edges) {
      console.log(`${from} -> ${[...targets].join(", ")}`);
    }
  }
}
