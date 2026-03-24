import { analyzeFile } from "./analyzer/core/analyzer";
import { ModuleGraph } from "./analyzer/graph/module/moduleGraph";
import { getAllTSFiles } from "./scanner/fileScanner";
// import { analyzeFile } from "./analyzer/fileAnalyzer";
import { ProjectReport } from "./types/report";

export function analyzeProject(rootDir?: string): ProjectReport {
  const files = getAllTSFiles(rootDir);

  let totalFunctions = 0;
  let totalVariables = 0;
  let totalImports = 0;
  let filesWithConsole: string[] = [];
  const moduleGraph = new ModuleGraph();
  for (const file of files) {
    const report = analyzeFile(file, moduleGraph);
    // totalFunctions += report.functionCount;
    // totalVariables += report.variableCount;
    // totalImports += report.importCount;

    // if (report.hasConsoleLog) {
    //   filesWithConsole.push(file);
    // }
  }

  console.log(moduleGraph);

  return {
    totalFiles: files.length,
    totalFunctions,
    totalVariables,
    totalImports,
    filesWithConsole,
  };
}
