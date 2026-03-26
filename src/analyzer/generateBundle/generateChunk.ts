import fs from "fs";
import path from "path";
import { Chunk, ChunkGraph } from "../chunkGraphBuilder";
import { ModuleGraph } from "../graph/module/moduleGraph";

/**
 * Bundle 生成选项
 */
export interface BundleOptions {
  /** 输出目录 */
  outputDir: string;
  /** 公共路径 */
  publicPath?: string;
}

/**
 * Bundle 生成结果
 */
export interface BundleResult {
  /** 生成的文件路径 */
  filePath: string;
  /** 代码内容 */
  code: string;
  /** 包含的模块数 */
  moduleCount: number;
}

/**
 * 简化版 Chunk Bundle 生成器
 *
 * 核心概念：
 * 1. 每个模块包裹成函数，放入 modules 对象
 * 2. 提供 __webpack_require__ 函数加载模块
 * 3. 模块通过 module.exports 导出
 * 4. 入口模块最后执行
 */
export function generateChunkBundle(
  chunk: Chunk,
  moduleGraph: ModuleGraph,
  options: BundleOptions,
): BundleResult {
  const { outputDir, publicPath = "" } = options;

  // 1. 生成模块加载器 runtime
  const runtime = generateRuntime(publicPath);

  // 2. 生成所有模块代码
  const modules = generateModules(chunk, moduleGraph);

  // 3. 生成启动代码（执行入口模块）
  const bootstrap = chunk.entryModule
    ? `\n// 执行入口模块\n__webpack_require__("${chunk.entryModule}");`
    : "";

  // 4. 组装 bundle
  const bundleCode = `(${runtime})({${modules}})${bootstrap}`;
  debugger;
  // 5. 写入文件
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = chunk.type === "entry" ? `${chunk.name}.js` : `${chunk.name}.chunk.js`;
  const filePath = path.join(outputDir, fileName);

  fs.writeFileSync(filePath, bundleCode);

  return {
    filePath,
    code: bundleCode,
    moduleCount: chunk.modules.size,
  };
}

/**
 * 生成模块加载器 runtime
 *
 * 返回一个 IIFE，接收 modules 对象，返回 __webpack_require__ 函数
 */
function generateRuntime(publicPath: string): string {
  return `
function(modules) {
  // 模块缓存
  var installedModules = {};

  // 模块加载函数
  function __webpack_require__(moduleId) {
    // 检查缓存
    if (installedModules[moduleId]) {
      return installedModules[moduleId].exports;
    }

    // 创建模块
    var module = installedModules[moduleId] = {
      id: moduleId,
      loaded: false,
      exports: {}
    };

    // 执行模块函数
    modules[moduleId](module, module.exports, __webpack_require__);

    // 标记已加载
    module.loaded = true;

    // 返回导出内容
    return module.exports;
  }

  // 暴露模块对象
  __webpack_require__.m = modules;

  // 公共路径
  __webpack_require__.p = "${publicPath}";

  return __webpack_require__;
}
`.trim();
}

/**
 * 生成所有模块的代码
 *
 * 格式: "模块路径": function(module, exports, __webpack_require__) { ... 模块代码 ... }
 */
function generateModules(chunk: Chunk, moduleGraph: ModuleGraph): string {
  const moduleCodes: string[] = [];

  for (const [modulePath, chunkModule] of chunk.modules) {
    // 获取模块源码
    const sourceCode = getModuleSource(modulePath, moduleGraph);

    // 转换 ES Module 语法为 CommonJS
    const transformedCode = transformModuleCode(sourceCode, modulePath, chunkModule.imports);

    // 包裹成函数
    moduleCodes.push(`
"${modulePath}": function(module, exports, __webpack_require__) {
${transformedCode}
}`);
  }

  return moduleCodes.join(",");
}

/**
 * 转换模块代码
 *
 * 主要转换：
 * 1. import -> __webpack_require__
 * 2. export -> module.exports
 */
function transformModuleCode(
  code: string,
  modulePath: string,
  imports: Map<string, string>,
): string {
  // 处理导入：import { foo } from './bar' -> var foo = __webpack_require__('./bar').foo
  code = transformImports(code, modulePath);

  // 处理默认导入：import foo from './bar' -> var foo = __webpack_require__('./bar').default
  code = transformDefaultImports(code, modulePath);

  // 处理导出：export const foo = 1 -> var foo = 1; module.exports.foo = foo
  code = transformExports(code);

  // 处理默认导出：export default foo -> module.exports.default = foo
  code = transformDefaultExport(code);

  return code;
}

/**
 * 转换命名导入
 *
 * import { foo, bar as baz } from './module'
 * ->
 * var _module = __webpack_require__('./module');
 * var foo = _module.foo;
 * var baz = _module.bar;
 */
function transformImports(code: string, currentPath: string): string {
  // 匹配 import { ... } from '...'
  const regex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g;

  return code.replace(regex, (match, imports, source) => {
    const resolvedSource = resolvePath(source, currentPath);
    const tempVar = `_import_${hash(resolvedSource)}`;

    let result = `var ${tempVar} = __webpack_require__("${resolvedSource}");\n`;

    // 解析导入列表
    imports.split(",").forEach((item: string) => {
      const [name, alias] = item
        .trim()
        .split(/\s+as\s+/)
        .map((s: string) => s.trim());
      const localName = alias || name;
      result += `var ${localName} = ${tempVar}.${name};`;
    });

    return result;
  });
}

/**
 * 转换默认导入
 *
 * import foo from './module'
 * ->
 * var foo = __webpack_require__('./module').default;
 */
function transformDefaultImports(code: string, currentPath: string): string {
  const regex = /import\s+(\w+)\s+from\s*['"]([^'"]+)['"];?/g;

  return code.replace(regex, (match, name, source) => {
    const resolvedSource = resolvePath(source, currentPath);
    return `var ${name} = __webpack_require__("${resolvedSource}").default;`;
  });
}

/**
 * 转换命名导出
 *
 * export const foo = 1
 * export function bar() {}
 * ->
 * var foo = 1; module.exports.foo = foo;
 * function bar() {}; module.exports.bar = bar;
 */
function transformExports(code: string): string {
  // 匹配 export const|let|var|function
  const regex = /export\s+(const|let|var|function)\s+(\w+)/g;

  const exports: string[] = [];

  code = code.replace(regex, (match, type, name) => {
    exports.push(`module.exports.${name} = ${name};`);
    return type + " " + name;
  });

  // 在文件末尾添加导出
  if (exports.length > 0) {
    code += "\n" + exports.join("\n");
  }

  return code;
}

/**
 * 转换默认导出
 *
 * export default foo
 * export default function() {}
 * ->
 * module.exports.default = foo;
 * module.exports.default = function() {};
 */
function transformDefaultExport(code: string): string {
  // export default ...
  return code.replace(/export\s+default\s+(.+);?/, "module.exports.default = $1;");
}

/**
 * 获取模块源码
 */
function getModuleSource(modulePath: string, moduleGraph: ModuleGraph): string {
  // 从文件读取
  if (fs.existsSync(modulePath)) {
    return fs.readFileSync(modulePath, "utf-8");
  }

  // 从 moduleGraph 获取
  const mod = moduleGraph.modules.get(modulePath);
  if (mod?.code) {
    return mod.code;
  }

  return "// empty module";
}

/**
 * 解析相对路径为绝对路径
 */
function resolvePath(source: string, fromPath: string): string {
  if (source.startsWith("./") || source.startsWith("../")) {
    return path.resolve(path.dirname(fromPath), source);
  }
  return source;
}

/**
 * 简单哈希函数
 */
function hash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36).substring(0, 4);
}

/**
 * 生成所有 chunks 的 bundle
 */
export function generateAllBundles(
  chunkGraph: ChunkGraph,
  moduleGraph: ModuleGraph,
  options: BundleOptions,
): BundleResult[] {
  const results: BundleResult[] = [];

  for (const [_, chunk] of chunkGraph.chunks) {
    const result = generateChunkBundle(chunk, moduleGraph, options);
    results.push(result);
  }

  return results;
}
