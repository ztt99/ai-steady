import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";
import Reference from "../../reference/reference";

/**
 * 引用插件
 * 负责识别代码中的标识符引用，建立引用关系和依赖图
 */
export class ReferencePlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    // 处理 this 关键字
    if (node.kind === ts.SyntaxKind.ThisKeyword) {
      this.handleThisReference(node, ctx);
      return;
    }

    // 处理 super 关键字
    if (node.kind === ts.SyntaxKind.SuperKeyword) {
      this.handleSuperReference(node, ctx);
      return;
    }

    if (!ts.isIdentifier(node)) return;

    const parent = node.parent;

    // 排除声明位置
    if (this.isDeclarationPosition(parent, node)) {
      return;
    }

    // 排除属性名（在属性访问表达式中，右边的标识符不是引用）
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
      return;
    }

    // 排除标签名（在循环和 switch 中）
    if (this.isLabelName(parent, node)) {
      return;
    }

    // 排除模块导出名称
    if (this.isExportSpecifierName(parent, node)) {
      return;
    }

    const name = node.text;
    const scope = ctx.getScope(node);
    const binding = scope.resolve(name);

    // 创建引用记录
    const ref = new Reference(name, node, scope, binding ?? null);

    ctx.references.push(ref);

    if (binding) {
      // 收集这个变量的位置信息
      binding.references.push(ref);
    }

    // 建立依赖边
    if (ctx.currentBinding && binding) {
      ctx.symbolGraph.addEdge(ctx.currentBinding, binding, "dependency");
    }
  }

  beforeChildren(node: ts.Node, ctx: AnalyzerContext) {
    // 在进入子节点前，检查是否是函数调用
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) {
        // 标记当前处理的是函数调用上下文
        (ctx as any).currentCallTarget = callee.text;
      }
    }
  }

  exit(node: ts.Node, ctx: AnalyzerContext) {
    // 清理函数调用上下文
    if (ts.isCallExpression(node)) {
      (ctx as any).currentCallTarget = undefined;
    }
  }

  /**
   * 检查是否是声明位置
   */
  private isDeclarationPosition(parent: ts.Node, node: ts.Identifier): boolean {
    return (
      // 变量声明
      (ts.isVariableDeclaration(parent) && parent.name === node) ||
      // 函数声明
      (ts.isFunctionDeclaration(parent) && parent.name === node) ||
      (ts.isFunctionExpression(parent) && parent.name === node) ||
      // 函数参数
      (ts.isParameter(parent) && parent.name === node) ||
      // Catch 句参数
      (ts.isCatchClause(parent) && parent.variableDeclaration?.name === node) ||
      // 类声明
      (ts.isClassDeclaration(parent) && parent.name === node) ||
      (ts.isClassExpression(parent) && parent.name === node) ||
      // 方法声明
      (ts.isMethodDeclaration(parent) && parent.name === node) ||
      (ts.isMethodSignature(parent) && parent.name === node) ||
      // 属性声明
      (ts.isPropertyDeclaration(parent) && parent.name === node) ||
      (ts.isPropertySignature(parent) && parent.name === node) ||
      // Getter/Setter
      (ts.isGetAccessorDeclaration(parent) && parent.name === node) ||
      (ts.isSetAccessorDeclaration(parent) && parent.name === node) ||
      // 构造函数
      ts.isConstructorDeclaration(parent) ||
      // 接口声明
      (ts.isInterfaceDeclaration(parent) && parent.name === node) ||
      // 类型别名
      (ts.isTypeAliasDeclaration(parent) && parent.name === node) ||
      // 枚举
      (ts.isEnumDeclaration(parent) && parent.name === node) ||
      (ts.isEnumMember(parent) && parent.name === node) ||
      // 导入声明
      (ts.isImportClause(parent) && parent.name === node) ||
      (ts.isImportSpecifier(parent) && parent.name === node) ||
      (ts.isNamespaceImport(parent) && parent.name === node) ||
      // 泛型参数
      (ts.isTypeParameterDeclaration(parent) && parent.name === node) ||
      // 解构赋值
      (ts.isBindingElement(parent) && parent.name === node) ||
      // 属性简写
      (ts.isShorthandPropertyAssignment(parent) && parent.name === node) ||
      // 命名空间导出
      (ts.isNamespaceExportDeclaration(parent) && parent.name === node) ||
      // 模块声明
      (ts.isModuleDeclaration(parent) && parent.name === node)
    );
  }

  /**
   * 检查是否是标签名
   */
  private isLabelName(parent: ts.Node, node: ts.Identifier): boolean {
    return (
      // Break 和 Continue 标签
      (ts.isBreakOrContinueStatement(parent) && parent.label === node) ||
      // LabeledStatement 标签
      (ts.isLabeledStatement(parent) && parent.label === node)
    );
  }

  /**
   * 检查是否是导出规范名
   */
  private isExportSpecifierName(parent: ts.Node, node: ts.Identifier): boolean {
    return ts.isExportSpecifier(parent) && (parent.name === node || parent.propertyName === node);
  }

  /**
   * 处理 this 引用
   */
  private handleThisReference(node: ts.Node, ctx: AnalyzerContext) {
    const parent = node.parent;
    const scope = ctx.getScope(node);

    // 检查是否是函数调用中的 this
    if (ts.isCallExpression(parent) && parent.expression === node) {
      // this() 调用
      return;
    }

    // 建立特殊的 this 引用
    const ref = new Reference("this", node as any, scope, null);
    ctx.references.push(ref);
  }

  /**
   * 处理 super 引用
   */
  private handleSuperReference(node: ts.Node, ctx: AnalyzerContext) {
    const parent = node.parent;
    const scope = ctx.getScope(node);

    // super() 调用
    if (ts.isCallExpression(parent) && parent.expression === node) {
      const ref = new Reference("super", node as any, scope, null);
      ctx.references.push(ref);
      return;
    }

    // super.xxx 属性访问
    if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
      const ref = new Reference("super", node as any, scope, null);
      ctx.references.push(ref);
      return;
    }

    // 普通 super 引用
    const ref = new Reference("super", node as any, scope, null);
    ctx.references.push(ref);
  }
}
