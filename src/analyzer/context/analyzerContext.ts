import { Binding } from "../binding/Binding";
import Reference from "../reference/reference";

class AnalyzerContext {
  references: Reference[] = [];
  bindings: Binding[] = [];
}

export { AnalyzerContext };
