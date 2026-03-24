import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";
import { collectBindingNames } from "../../utils";

/**
 * ExportPlugin - 导出分析插件
 *
 * 责责：收集当前文件的所有导出声明，建立模块导出映射
 *
 * 处理的导出类型：
 * 1. 命名导出 (Named Exports)
 *    - export function foo() {}
 *    - export const x = 1
 *    - export class Bar {}
 *    - export { foo, bar }
 * 2. 默认导出 (Default Exports)
 *    - export default function() {}
 *    - export default expr
 * 3. 重新导出 (Re-exports)
 *    - export { foo } from './module'
 *    - export * from './module'
 *
 * 执行时机：在 HoistedPlugin 和 BindingPlugin 之后执行，确保绑定已创建
 */
export class ExportPlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    // 获取或创建当前模块节点
    const module = ctx.graph.ensureModule(ctx.filePath);
    const scope = ctx.getScope(node);

    // 处理带 export 修饰符的函数声明
    // export function foo() {}
    if (ts.isFunctionDeclaration(node) && this.hasExportModifier(node)) {
      this.handleNamedExport(node.name, scope, module.exports);
      return;
    }

    // 处理带 export 修饰符的变量声明
    // export const x = 1, y = 2
    if (ts.isVariableStatement(node) && this.hasExportModifier(node)) {
      this.handleVariableExport(node, scope, module.exports);
      return;
    }

    // 处理带 export 修饰符的类声明
    // export class Foo {}
    if (ts.isClassDeclaration(node) && this.hasExportModifier(node)) {
      this.handleNamedExport(node.name, scope, module.exports);
      return;
    }

    // 处理带 export 修饰符的接口声明
    // export interface Foo {}
    if (ts.isInterfaceDeclaration(node) && this.hasExportModifier(node)) {
      this.handleNamedExport(node.name, scope, module.exports);
      return;
    }

    // 处理带 export 修饰符的类型别名
    // export type Foo = string
    if (ts.isTypeAliasDeclaration(node) && this.hasExportModifier(node)) {
      this.handleNamedExport(node.name, scope, module.exports);
      return;
    }

    // 处理带 export 修饰符的枚举
    // export enum Color { Red, Blue }
    if (ts.isEnumDeclaration(node) && this.hasExportModifier(node)) {
      this.handleNamedExport(node.name, scope, module.exports);
      return;
    }

    // 处理默认导出
    // export default function() {} / export default expr
    if (ts.isExportAssignment(node)) {
      this.handleDefaultExport(node, scope, module);
      return;
    }

    // 处理导出声明（export { ... }）
    if (ts.isExportDeclaration(node)) {
      this.handleExportDeclaration(node, scope, module);
      return;
    }
  }

  exit() {
    // 导出分析不需要 exit 处理
  }

  /**
   * 检查节点是否有 export 修饰符
   */
  private hasExportModifier(node: ts.HasModifiers): boolean {
    return !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  }

  /**
   * 检查节点是否有 default 修饰符
   */
  private hasDefaultModifier(node: ts.HasModifiers): boolean {
    return !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
  }

  /**
   * 处理命名导出
   * 将名称与绑定关联，加入模块的导出映射
   */
  private handleNamedExport(
    nameNode: ts.Identifier | undefined,
    scope: ReturnType<AnalyzerContext["getScope"]>,
    exports: Map<string, ReturnType<typeof scope.resolve>>,
  ): void {
    if (!nameNode) return;

    const name = nameNode.text;
    const binding = scope.resolve(name);
    if (binding) {
      exports.set(name, binding);
    }
  }

  /**
   * 处理变量导出
   * 支持解构赋值中的多个绑定
   */
  private handleVariableExport(
    node: ts.VariableStatement,
    scope: ReturnType<AnalyzerContext["getScope"]>,
    exports: Map<string, ReturnType<typeof scope.resolve>>,
  ): void {
    for (const decl of node.declarationList.declarations) {
      // 处理普通标识符和解构模式
      collectBindingNames(decl.name, (name) => {
        const binding = scope.resolve(name);
        if (binding) {
          exports.set(name, binding);
        }
      });
    }
  }

  /**
   * 处理默认导出
   * export default function() {} / export default expr
   */
  private handleDefaultExport(
    node: ts.ExportAssignment,
    scope: ReturnType<AnalyzerContext["getScope"]>,
    module: ReturnType<AnalyzerContext["graph"]["ensureModule"]>,
  ): void {
    // 获取默认导出的表达式
    const expression = node.expression;

    if (ts.isIdentifier(expression)) {
      // export default foo → 引用已有的绑定
      const binding = scope.resolve(expression.text);
      if (binding) {
        module.defaultExport = binding;
        module.exports.set("default", binding);
      }
    } else if (ts.isFunctionExpression(expression) && expression.name) {
      // export default function() {} 有名称的情况
      const binding = scope.resolve(expression.name.text);
      if (binding) {
        module.defaultExport = binding;
        module.exports.set("default", binding);
      }
    } else if (ts.isClassExpression(expression) && expression.name) {
      // export default class {} 有名称的情况
      const binding = scope.resolve(expression.name.text);
      if (binding) {
        module.defaultExport = binding;
        module.exports.set("default", binding);
      }
    } else {
      // 其他表达式导出，记录为匿名导出
      module.hasDefaultExport = true;
    }
  }

  /**
   * 处理导出声明（export { ... }）
   * 支持本地导出和重新导出
   */
  private handleExportDeclaration(
    node: ts.ExportDeclaration,
    scope: ReturnType<AnalyzerContext["getScope"]>,
    module: ReturnType<AnalyzerContext["graph"]["ensureModule"]>,
  ): void {
    // 处理重新导出：export { foo } from './module'
    if (node.moduleSpecifier) {
      // 这是重新导出，需要在模块链接阶段处理
      // 这釬只记录导出声明
      const specifier = node.moduleSpecifier;
      if (ts.isStringLiteral(specifier)) {
        module.reExports.push({
          source: specifier.text,
          exportClause: node.exportClause,
        });
      }
      return;
    }

    // 处理本地导出：export { foo, bar as baz }
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        // 获取导出名（可能有别名）
        const exportName = element.name.text;
        // 获取本地名称（propertyName 是原名，name 是别名）
        const localName = element.propertyName?.text ?? exportName;

        const binding = scope.resolve(localName);
        if (binding) {
          module.exports.set(exportName, binding);
        }
      }
    }
  }
}
