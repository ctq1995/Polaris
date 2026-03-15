/**
 * LSP 模块入口
 */

// 从 TypeScript LSP 导出
export {
  createTypeScriptExtensions,
  createJavaScriptExtensions,
  getTSEnvironment,
  updateTSFile,
  cleanupTSEnvironment,
  gotoDefinition as tsGotoDefinition,
  findReferences as tsFindReferences,
  getHoverInfo as tsGetHoverInfo,
} from './typescriptLsp';

// 从 Rust LSP 导出
export {
  createRustExtensions,
  initializeRustLSP,
  shutdownRustLSP,
  cleanupRustLSP,
  gotoDefinition as rustGotoDefinition,
  findReferences as rustFindReferences,
} from './rustLsp';

// LSP 扩展创建工厂
import type { Extension } from '@codemirror/state';
import {
  createTypeScriptExtensions,
  createJavaScriptExtensions,
  cleanupTSEnvironment,
} from './typescriptLsp';
import {
  createRustExtensions,
  cleanupRustLSP,
} from './rustLsp';

export interface LSPExtensionsOptions {
  /** 文件路径 */
  filePath: string;
  /** 初始内容 */
  content: string;
  /** 语言类型 */
  language: string;
  /** 工作区根目录（用于 Rust LSP） */
  workspaceRoot?: string;
}

/**
 * 根据语言创建 LSP 扩展
 */
export async function createLSPExtensions(options: LSPExtensionsOptions): Promise<Extension[]> {
  const { filePath, content, language, workspaceRoot } = options;

  switch (language) {
    case 'typescript':
    case 'tsx':
      return createTypeScriptExtensions(filePath, content);

    case 'javascript':
    case 'jsx':
      return createJavaScriptExtensions(filePath, content);

    case 'rust':
      if (workspaceRoot) {
        return createRustExtensions(filePath, workspaceRoot);
      }
      console.warn('[LSP] Rust LSP requires workspaceRoot');
      return [];

    default:
      // 其他语言暂不支持 LSP
      return [];
  }
}

/**
 * 清理所有 LSP 资源
 */
export function cleanupAllLSP(): void {
  cleanupTSEnvironment();
  cleanupRustLSP();
}
