import fs from "fs";
import path from "path";

function scanFiles(dir: string) {
  let results: string[] = [];

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(scanFiles(filePath));
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      results.push(filePath);
    }
  }
  return results;
}

export { scanFiles };
