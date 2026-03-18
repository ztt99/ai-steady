import { Module } from "./module";

export class ModuleGraph {
  modules = new Map<string, Module>();

  ensureModule(id: string) {
    if (!this.modules.has(id)) {
      this.modules.set(id, new Module(id));
    }

    return this.modules.get(id)!;
  }
}
