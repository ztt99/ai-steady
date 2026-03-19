#!/usr/bin/env node

import { Command } from "commander";
import { analyzeProject } from ".";
// import { analyzeFile } from "./analyzer/fileAnalyzer";
const program = new Command();

// 定义命令
// program
//   .command("init")
//   .description("初始化项目")
//   .action(() => {
//     console.log("初始化项目...");
//   });

// program
//   .name("ai-structure")
//   .description("AI CLI 工具")
//   .argument("<dir>", "要扫描的目录") //必填的参数
//   .action((dir: string) => {
//     // 查询这个路径是否存在，不存在报错 __dirname 不可以，我们要找的是运行环境的 url
//     const fullPath = path.join(process.cwd(), dir);

//     if (!fs.existsSync(fullPath)) {
//       console.error(`目录不存在: ${fullPath}`);
//       process.exit(1);
//     }

//     const files = scanFiles(fullPath);

//     // for (const file of files) {
//     //   // const analysisResult = analyzeFile(file);
//     // }
//     console.log(`files: `, files);
//   });

program
  .name("ai-structure2")
  .argument("<dir>", "要扫描的目录")
  .action((dir: string) => {
    console.log(analyzeProject(dir));
  });

// 解析参数
program.parse(process.argv);

var a = 1;
