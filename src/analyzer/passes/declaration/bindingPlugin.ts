import ts from "typescript";
import { AnalyzerPlugin } from "../../core/analyzer";
import { AnalyzerContext } from "../../core/context";
import { getVariableKind, collectBindingNames } from "../../utils";

/**
 * BindingPlugin - 绑定插件
 * 负责初始化变量、函数、类等绑定，设置当前绑定上下文
 * 注意：绑定的声明（declare）是在 HoistedPlugin 中完成的，这里只做初始化
 */
export class BindingPlugin implements AnalyzerPlugin {
  enter(node: ts.Node, ctx: AnalyzerContext) {
    // 处理变量声明（包含解构）
    if (ts.isVariableDeclaration(node)) {
      this.handleVariableDeclaration(node, ctx);
      return;
    }

    // 处理函数声明
    if (ts.isFunctionDeclaration(node) && node.name) {
      this.handleFunctionBinding(node.name.text, node, ctx);
      return;
    }

    // 处理函数表达式（有名称的）
    if (ts.isFunctionExpression(node) && node.name) {
      this.handleFunctionBinding(node.name.text, node, ctx);
      return;
    }

    // 处理箭头函数
    if (ts.isArrowFunction(node)) {
      this.handleArrowFunction(node, ctx);
      return;
    }

    // 处理类声明
    if (ts.isClassDeclaration(node) && node.name) {
      this.handleClassBinding(node.name.text, node, ctx);
      return;
    }

    // 处理类表达式（有名称的）
    if (ts.isClassExpression(node) && node.name) {
      this.handleClassBinding(node.name.text, node, ctx);
      return;
    }

    // 处理方法声明
    if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      this.handleMethodBinding(node.name.text, node, ctx);
      return;
    }

    // 处理 Getter/Setter
    if ((ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) && 
        node.name && ts.isIdentifier(node.name)) {
      this.handleAccessorBinding(node.name.text, node, ctx);
      return;
    }

    // 处理捕获句的异常变量
    if (ts.isCatchClause(node) && node.variableDeclaration) {
      this.handleCatchClause(node, ctx);
      return;
    }
  }

  beforeChildren(node: ts.Node, ctx: AnalyzerContext) {
    // 在进入子节点前，如果当前节点是函数/类，设置函数绑定上下文
    // 这样子节点中的引用可以知道它们在哪个函数内部
    if (ts.isFunctionDeclaration(node) && node.name) {
      const scope = ctx.getScope(node);
      const binding = scope.resolve(node.name.text);
      if (binding) {
        ctx.currentFunctionBinding = binding;
      }
    } else if (ts.isFunctionExpression(node) && node.name) {
      const scope = ctx.getScope(node);
      const binding = scope.resolve(node.name.text);
      if (binding) {
        ctx.currentFunctionBinding = binding;
      }
    } else if (ts.isArrowFunction(node)) {
      // 箭头函数没有名称，但是可以创建一个匿名绑定
      // 或者使用父级的函数绑定
      // 这里保留当前函数绑定不变
    }
  }

  exit(node: ts.Node, ctx: AnalyzerContext) {
    // 清理当前绑定上下文
    if (
      ts.isVariableDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node)
    ) {
      ctx.currentBinding = undefined;
    }

    // 清理函数绑定上下文
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      ctx.currentFunctionBinding = undefined;
      ctx.currentBinding = undefined;
    }
  }

  /**
   * 处理变量声明
   * 支持普通变量和解构赋值
   */
  private handleVariableDeclaration(node: ts.VariableDeclaration, ctx: AnalyzerContext) {
    const kind = getVariableKind(node.parent);
    const scope = ctx.getScope(node);

    // 处理解构模式
    if (!ts.isIdentifier(node.name)) {
      collectBindingNames(node.name, (name) => {
        const binding = scope.resolve(name);
        if (binding) {
          binding.initialize();
          ctx.currentBinding = binding;
        }
      });
      return;
    }

    // 处理普通标识符
    const name = node.name.text;
    const binding = scope.resolve(name);

    if (binding) {
      binding.initialize();
      ctx.currentBinding = binding;

      // var 声明需要特殊处理：变量提升但初始化在当前位置
      if (kind === "var") {
        // var 的初始化完成
        binding.state = "initialized";
      }
    }
  }

  /**
   * 处理函数绑定
   */
  private handleFunctionBinding(name: string, node: ts.FunctionDeclaration | ts.FunctionExpression, ctx: AnalyzerContext) {
    const scope = ctx.getScope(node);
    const binding = scope.resolve(name);

    if (binding) {
      binding.initialize();
      ctx.currentBinding = binding;
      ctx.currentFunctionBinding = binding;
    }
  }

  /**
   * 处理箭头函数
   */
  private handleArrowFunction(node: ts.ArrowFunction, ctx: AnalyzerContext) {
    // 箭头函数没有自己的绑定名称
    // 但我们可以设置一个匿名函数绑定上下文
    // 保留当前函数绑定不变（使用父级函数的绑定）
    // 或者创建一个特殊的箭头函数标记
  }

  /**
   * 处理类绑定
   */
  private handleClassBinding(name: string, node: ts.ClassDeclaration | ts.ClassExpression, ctx: AnalyzerContext) {
    const scope = ctx.getScope(node);
    const binding = scope.resolve(name);

    if (binding) {
      binding.initialize();
      ctx.currentBinding = binding;
    }
  }

  /**
   * 处理方法绑定
   */
  private handleMethodBinding(name: string, node: ts.MethodDeclaration, ctx: AnalyzerContext) {
    const scope = ctx.getScope(node);
    const binding = scope.resolve(name);

    if (binding) {
      binding.initialize();
      ctx.currentBinding = binding;
      ctx.currentFunctionBinding = binding;
    }
  }

  /**
   * 处理 Getter/Setter 绑定
   */
  private handleAccessorBinding(name: string, node: ts.AccessorDeclaration, ctx: AnalyzerContext) {
    const scope = ctx.getScope(node);
    const binding = scope.resolve(name);

    if (binding) {
      binding.initialize();
      ctx.currentBinding = binding;
    }
  }

  /**
   * 处理捕获句的异常变量
   */
  private handleCatchClause(node: ts.CatchClause, ctx: AnalyzerContext) {
    if (!node.variableDeclaration) return;

    const scope = ctx.getScope(node);
    const varDecl = node.variableDeclaration;

    if (ts.isIdentifier(varDecl.name)) {
      const name = varDecl.name.text;
      const binding = scope.resolve(name);
      if (binding) {
        binding.initialize();
        ctx.currentBinding = binding;
      }
    } else {
      // 解构模式
      collectBindingNames(varDecl.name, (name) => {
        const binding = scope.resolve(name);
        if (binding) {
          binding.initialize();
          ctx.currentBinding = binding;
        }
      });
    }
  }
}
