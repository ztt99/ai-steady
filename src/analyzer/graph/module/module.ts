import { Binding } from "../../binding/Binding";

export class Module {
  id: string;

  imports = new Map<string, string>();

  exports = new Map<string, Binding>();

  dependencies = new Set<string>();

  importers = new Set<string>();

  constructor(id: string) {
    this.id = id;
  }
}
