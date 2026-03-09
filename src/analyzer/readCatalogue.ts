import path from "path";
import fs from "fs";

function readCatalogue(dir = process.cwd(), depth = 0) {
  const files = fs.readdirSync(dir);
  for (let file of files) {
    if (["note"].includes(file)) continue;
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      console.log(`${"|--".repeat(depth)}${file}`);
      readCatalogue(filePath, depth + 1);
    } else {
      console.log(`${"|--".repeat(depth)}${file}`);
    }
  }
}

readCatalogue(path.join(process.cwd(), "src"));
