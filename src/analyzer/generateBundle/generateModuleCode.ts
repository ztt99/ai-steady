import { ChunkModule } from "../chunkGraphBuilder";

export function generateModuleCode(module: ChunkModule) {
  return `
"${module.path}": function(require, exports) {
  ${module.code}
}
`;
}
