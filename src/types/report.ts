export interface FileReport {
  filePath: string;
  functionCount: number;
  variableCount: number;
  importCount: number;
  hasConsoleLog: boolean;
}

export interface ProjectReport {
  totalFiles: number;
  totalFunctions: number;
  totalVariables: number;
  totalImports: number;
  filesWithConsole: string[];
}
