import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";
import { ImportBinding } from "../../graph/module/module";

/**
 * 导入分析插件 (ImportPlugin)
 *
 * 责责：收集当前文件的所有导入声明，建立模块依赖关系
 *
 * 处理的导入类型：
 * 1. 命名导入 (Named Imports)
 *    - import { foo, bar } from './module'
 *    - import { foo as bar } from './module' (别名)
 * 2. 默认导入 (Default Import)
 *    - import foo from './module'
 * 3. 命名空间导入 (Namespace Import)
 *    - import * as foo from './module'
 * 4. 空导入 (Side Effect Import)
 *    - import './module' (只执行副作用，不导入绑定)
 *
 * 注意：
 * - 绑定的声明（declare）是在 HoistedPlugin 中完成的
 * - 这里只负责收集导入信息到 ModuleGraph 和 ImportGraph
 *
 * 执行顺序：在 HoistedPlugin 之后执行
 */
export class ImportPlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext): void {
    // 只处理导入声明
    if (!ts.isImportDeclaration(node)) return;
    debugger;

    // 获取当前模块
    const module = ctx.graph.ensureModule(ctx.filePath);

    // 获取源模块路径
    const moduleSpecifier = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) return;

    const sourcePath = moduleSpecifier.text;

    // 记录模块依赖关系
    module.dependencies.add(sourcePath);
    // 处理空导入 (import './module')
    const importClause = node.importClause;
    if (!importClause) {
      // 纯副作用导入，只记录依赖，不导入绑定
      return;
    }

    // 处理默认导入 (import foo from './module')
    if (importClause.name) {
      const localName = importClause.name.text;
      // 记录导入映射: 本地名称 -> 源模块
      module.imports.set(localName, {
        localName: localName,
        importedName: "default",
        source: sourcePath,
      });
    }

    // 处理命名导入和命名空间导入
    const namedBindings = importClause.namedBindings;
    if (!namedBindings) return;

    if (ts.isNamedImports(namedBindings)) {
      // 命名导入: import { foo, bar as baz } from './module'
      this.handleNamedImports(namedBindings, sourcePath, module.imports);
    } else if (ts.isNamespaceImport(namedBindings)) {
      // 命名空间导入: import * as foo from './module'
      const localName = namedBindings.name.text;
      module.imports.set(localName, {
        localName,
        importedName: "*",
        source: sourcePath,
      });
    }
  }

  exit(_node: ts.Node, _ctx: AnalyzerContext): void {
    // ImportPlugin 不需要 exit 处理
  }

  /**
   * 处理命名导入
   *
   * 例子:
   * - import { foo } from './module'  -> 记录 foo -> './module'
   * - import { foo as bar } from './module' -> 记录 bar -> './module'
   *
   * @param namedBindings 命名导入元素列表
   * @param sourcePath 源模块路径
   * @param imports 模块的导入映射表
   */
  private handleNamedImports(
    namedBindings: ts.NamedImports,
    sourcePath: string,
    imports: Map<string, ImportBinding>,
  ): void {
    for (const element of namedBindings.elements) {
      // element.name 是本地名称（如果有别名则为别名）
      // element.propertyName 是原名（仅在有别名时存在）
      const localName = element.name.text; // 有别名的时候是别名
      const originalName = element.propertyName?.text ?? localName;
      // 记录导入映射
      imports.set(localName, {
        localName: localName,
        importedName: originalName,
        source: sourcePath,
      });
    }
  }
}
