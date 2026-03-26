import { Binding } from "../../binding/Binding";
import ts from "typescript";

/**
 * 重新导出信息
 */
export interface ReExportInfo {
  /** 源模块路径 */
  source: string;
  /** 导出条款（null 表示 export * from '...' 全部导出） */
  exportClause: ts.NamedExports | ts.NamespaceExport | undefined;
}

export type ImportBinding = {
  localName: string; // foo
  importedName: string; // foo / default / *
  source: string; // "./a"
};

export class Module {
  id: string;

  code: string | null = null;
  /** 导入映射: 本地名称 -> 源模块 */
  imports = new Map<string, ImportBinding>();

  /** 命名导出: 导出名称 -> 绑定 */
  exports = new Map<string, Binding>();

  /** 默认导出绑定（export default ...有名称的情况） */
  defaultExport?: Binding;

  /** 是否有默认导出（包括匿名导出） */
  hasDefaultExport = false;

  /** 重新导出列表: export { ... } from '...' 和 export * from '...' */
  reExports: ReExportInfo[] = [];

  /** 模块依赖（源模块路径集合） */
  dependencies = new Set<string>();

  /** 引用该模块的模块 */
  importers = new Set<string>();
  /** 模块内定义的变量（包括 import 引入的绑定） */
  bindings = new Set<Binding>();
  constructor(id: string) {
    this.id = id;
  }
}
