import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";
import { collectBindingNames, getVariableKind } from "../../utils";
import { Binding } from "../../binding/Binding";

/**
 * HoistedPlugin - 变量提升插件
 *
 * 在代码执行前，预先声明所有需要提升的绑定：
 * - function 声明：完整提升（函数体也提升）
 * - var 声明：部分提升（只提升声明，不提升赋值）
 * - import 声明：视为已提升
 * - let/const/class：不提升（暂时性死区）
 *
 * 执行顺序：这是第一轮遍历，在 BindingPlugin 之前执行
 */
export class HoistedPlugin implements AnalyzerPlugin {
  enter(childNode: ts.Node, ctx: AnalyzerContext) {
    // 获取当前模块（用于收集变量 binding）
    const module = ctx.moduleGraph.ensureModule(ctx.filePath);

    // 使用内联函数遍历当前节点的所有子语句
    // const walkStatement = (childNode: ts.Node) => {
    // 函数声明：完整提升到函数作用域
    if (ts.isFunctionDeclaration(childNode) && childNode.name) {
      this.declareInFunctionScope(ctx, (scope) => {
        const name = childNode.name!.text;
        const binding = new Binding(childNode.name!.text, "function", scope, []);
        scope.declare(name, binding);
        module.bindings.add(binding);
      });
      return;
    }

    // 函数参数：声明在当前函数作用域
    if (ts.isParameter(childNode) && ts.isIdentifier(childNode.name)) {
      const name = childNode.name!.text;
      const binding = new Binding(childNode.name!.text, "param", ctx.currentScope, []);
      ctx.currentScope.declare(name, binding);
      module.bindings.add(binding);
      return;
    }

    // 阻止进入函数/类作用域边界
    // 这些节点会在遍历到它们时单独处理，避免重复声明
    if (this.isScopeBoundary(childNode)) {
      return;
    }

    // 导入声明：在模块顶层声明
    // if (ts.isImportDeclaration(childNode)) {
    //   this.handleImportDeclaration(childNode, ctx);
    //   return;
    // }

    // 变量声明：处理 var 提升和 let/const 声明
    if (ts.isVariableStatement(childNode)) {
      this.handleVariableStatement(childNode, ctx);
      return;
    }

    // 类声明：let/const 一样，不提升，但需要声明
    if (ts.isClassDeclaration(childNode) && childNode.name) {
      this.handleClassDeclaration(childNode, ctx);
      return;
    }

    // 捕获句参数
    if (ts.isCatchClause(childNode)) {
      this.handleCatchClause(childNode, ctx);
      return;
    }
    // };

    // ts.forEachChild(node, walkStatement);
  }

  exit(_node: ts.Node, _ctx: AnalyzerContext) {
    // HoistedPlugin 不需要 exit 处理
  }

  /**
   * 检查节点是否是作用域边界
   */
  private isScopeBoundary(node: ts.Node): boolean {
    return (
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isFunctionDeclaration(node)
    );
  }

  /**
   * 在函数作用域中声明绑定
   * 用于 function 声明和 var 变量的提升
   */
  private declareInFunctionScope(
    ctx: AnalyzerContext,
    declareFn: (scope: typeof ctx.currentScope) => void,
  ): void {
    let scope = ctx.currentScope;
    while (scope.parent && !scope.isFunctionScope()) {
      scope = scope.parent;
    }
    declareFn(scope);
  }

  /**
   * 处理变量声明语句
   */
  private handleVariableStatement(node: ts.VariableStatement, ctx: AnalyzerContext): void {
    const kind = getVariableKind(node.declarationList);
    const module = ctx.moduleGraph.ensureModule(ctx.filePath);

    for (const decl of node.declarationList.declarations) {
      collectBindingNames(decl.name, (name) => {
        if (kind === "var") {
          // var 变量提升到函数作用域
          this.declareInFunctionScope(ctx, (scope) => {
            const binding = new Binding(name, "var", scope, []);
            scope.declare(name, binding);
            module.bindings.add(binding);
          });
        } else {
          // let/const 不提升，在当前块级作用域声明
          const binding = new Binding(name, kind, ctx.currentScope, []);
          ctx.currentScope.declare(name, binding);
          module.bindings.add(binding);
        }
      });
    }
  }

  /**
   * 处理类声明
   * 类声明不会被提升（与 let 类似，存在暂时性死区）
   */
  private handleClassDeclaration(node: ts.ClassDeclaration, ctx: AnalyzerContext): void {
    // 类声明在当前作用城声明，不提升
    // 注：类的提升行为与 let 相同，都是暂时性死区（TDZ）
    const module = ctx.moduleGraph.ensureModule(ctx.filePath);
    const binding = new Binding(node.name!.text, "function", ctx.currentScope, []);
    ctx.currentScope.declare(node.name!.text, binding);
    module.bindings.add(binding);
  }

  /**
   * 处理捕获句
   */
  private handleCatchClause(node: ts.CatchClause, ctx: AnalyzerContext): void {
    if (!node.variableDeclaration) return;

    // catch 参数创建一个新的块级作用域
    // 但在这里只声明绑定，作用域创建在 ScopePlugin 中处理
    const varDecl = node.variableDeclaration;
    const module = ctx.moduleGraph.ensureModule(ctx.filePath);

    if (ts.isIdentifier(varDecl.name)) {
      const binding = new Binding(varDecl.name.text, "param", ctx.currentScope, []);
      ctx.currentScope.declare(varDecl.name.text, binding);
      module.bindings.add(binding);
    } else {
      // 解构模式: catch ({ message }) { ... }
      collectBindingNames(varDecl.name, (name) => {
        const binding = new Binding(name, "param", ctx.currentScope, []);
        ctx.currentScope.declare(name, binding);
        module.bindings.add(binding);
      });
    }
  }
}
