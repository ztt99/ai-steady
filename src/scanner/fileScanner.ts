import fs from "fs";
import path, { join } from "path";

function getAllTSFiles(dir?: string) {
  const rootPath = dir || process.cwd();
  const ignore = ["node_modules", "dist"];
  console.log(`Scanning directory: ${rootPath}`);

  const files = fs.readdirSync(rootPath).filter((file) => !ignore.includes(file));
  const results: string[] = [];
  for (const file of files) {
    const fullPath = path.join(rootPath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      // 递归处理子目录
      results.push(...getAllTSFiles(fullPath));
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      // 处理 TypeScript 文件
      results.push(path.join(rootPath, file));
    }
  }
  return results;
}

export { getAllTSFiles };
