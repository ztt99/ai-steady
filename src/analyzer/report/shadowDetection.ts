import { Binding } from "../binding/Binding";
import { Scope } from "../scope/scope";

class ShadowReport {
  name: string;
  outerKind: string;
  innerKind: string;
  line: number;
  column: number;

  constructor(name: string, outerKind: string, innerKind: string, line: number, column: number) {
    this.name = name;
    this.outerKind = outerKind;
    this.innerKind = innerKind;
    this.line = line;
    this.column = column;
  }
}
function checkShadow(binding: Binding): Binding | undefined {
  const outerBinding = binding.scope.parent?.resolve(binding.name);
  return outerBinding;
}

export { checkShadow };
