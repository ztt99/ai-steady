import { Binding } from "../binding/Binding";

export class SymbolNode {
  binding: Binding;

  constructor(binding: Binding) {
    this.binding = binding;
  }
}
