/**
 * Rust LSP 客户端
 * 通过 Tauri 后端与 rust-analyzer 通信
 */

import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { linter, Diagnostic } from '@codemirror/lint';
import { autocompletion, Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { invoke } from '@tauri-apps/api/core';
import type { LSPLocation, LSPDiagnostic, LSPCompletionItem } from '../../../types/lsp';

/**
 * 初始化 Rust LSP
 */
export async function initializeRustLSP(workspaceRoot: string): Promise<boolean> {
  try {
    await invoke('lsp_start_server', {
      language: 'rust',
      workspaceRoot,
    });
    return true;
  } catch (error) {
    console.error('[Rust LSP] Failed to initialize:', error);
    return false;
  }
}

/**
 * 关闭 Rust LSP
 */
export async function shutdownRustLSP(): Promise<void> {
  try {
    await invoke('lsp_stop_server', { language: 'rust' });
  } catch (error) {
    console.error('[Rust LSP] Failed to shutdown:', error);
  }
}

/**
 * 通知 LSP 文件内容变化
 */
export async function notifyFileChange(filePath: string, content: string): Promise<void> {
  try {
    await invoke('lsp_did_change', {
      language: 'rust',
      uri: `file://${filePath}`,
      content,
    });
  } catch (error) {
    console.error('[Rust LSP] Failed to notify file change:', error);
  }
}

/**
 * 请求补全
 */
export async function requestCompletion(
  filePath: string,
  content: string,
  line: number,
  character: number
): Promise<LSPCompletionItem[]> {
  try {
    const result = await invoke<LSPCompletionItem[]>('lsp_completion', {
      language: 'rust',
      uri: `file://${filePath}`,
      content,
      line,
      character,
    });
    return result || [];
  } catch (error) {
    console.error('[Rust LSP] Completion request failed:', error);
    return [];
  }
}

/**
 * 请求诊断
 */
export async function requestDiagnostics(filePath: string): Promise<LSPDiagnostic[]> {
  try {
    const result = await invoke<LSPDiagnostic[]>('lsp_diagnostics', {
      language: 'rust',
      uri: `file://${filePath}`,
    });
    return result || [];
  } catch (error) {
    console.error('[Rust LSP] Diagnostics request failed:', error);
    return [];
  }
}

/**
 * 跳转到定义
 */
export async function gotoDefinition(
  filePath: string,
  line: number,
  character: number
): Promise<LSPLocation | null> {
  try {
    const result = await invoke<LSPLocation | null>('lsp_goto_definition', {
      language: 'rust',
      uri: `file://${filePath}`,
      line,
      character,
    });
    return result;
  } catch (error) {
    console.error('[Rust LSP] Goto definition failed:', error);
    return null;
  }
}

/**
 * 查找引用
 */
export async function findReferences(
  filePath: string,
  line: number,
  character: number
): Promise<LSPLocation[]> {
  try {
    const result = await invoke<LSPLocation[]>('lsp_find_references', {
      language: 'rust',
      uri: `file://${filePath}`,
      line,
      character,
    });
    return result || [];
  } catch (error) {
    console.error('[Rust LSP] Find references failed:', error);
    return [];
  }
}

/**
 * 获取悬停信息
 */
export async function getHover(
  filePath: string,
  line: number,
  character: number
): Promise<{ contents: string } | null> {
  try {
    const result = await invoke<{ contents: string } | null>('lsp_hover', {
      language: 'rust',
      uri: `file://${filePath}`,
      line,
      character,
    });
    return result;
  } catch (error) {
    console.error('[Rust LSP] Hover request failed:', error);
    return null;
  }
}

/**
 * 转换 LSP 诊断到 CodeMirror 诊断
 */
function convertDiagnostics(lspDiagnostics: LSPDiagnostic[]): Diagnostic[] {
  return lspDiagnostics.map((diag) => ({
    from: diag.range.start.character,
    to: diag.range.end.character,
    severity: diag.severity === 1 ? 'error' : diag.severity === 2 ? 'warning' : 'info',
    message: diag.message,
  }));
}

/**
 * 转换 LSP 补全到 CodeMirror 补全
 */
function convertCompletions(items: LSPCompletionItem[]): Completion[] {
  return items.map((item) => ({
    label: item.label,
    type: getCompletionKind(item.kind),
    detail: item.detail,
    info: item.documentation,
    apply: item.insertText || item.label,
  }));
}

/**
 * 获取补全类型
 */
function getCompletionKind(kind: number): string {
  const kinds: Record<number, string> = {
    1: 'text',
    2: 'method',
    3: 'function',
    4: 'constructor',
    5: 'field',
    6: 'variable',
    7: 'class',
    8: 'interface',
    9: 'module',
    10: 'property',
    11: 'unit',
    12: 'value',
    13: 'enum',
    14: 'keyword',
    15: 'snippet',
    16: 'color',
    17: 'file',
    18: 'reference',
    19: 'folder',
    20: 'enumMember',
    21: 'constant',
    22: 'struct',
    23: 'event',
    24: 'operator',
    25: 'typeParameter',
  };
  return kinds[kind] || 'text';
}

/**
 * 创建 Rust LSP 补全源
 */
function createRustCompletionSource(filePath: string) {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const { state, pos } = context;
    const line = state.doc.lineAt(pos);
    const lineNo = line.number - 1;
    const character = pos - line.from;

    const items = await requestCompletion(filePath, state.doc.toString(), lineNo, character);

    if (items.length === 0) return null;

    // 找到补全起始位置
    const word = context.matchBefore(/\w+$/);
    const from = word ? word.from : pos;

    return {
      from,
      options: convertCompletions(items),
    };
  };
}

/**
 * 创建 Rust LSP 诊断 linter
 */
function createRustLinter(filePath: string) {
  return linter(async (): Promise<Diagnostic[]> => {
    const diagnostics = await requestDiagnostics(filePath);
    return convertDiagnostics(diagnostics);
  });
}

/**
 * 创建 Rust LSP 扩展
 */
export async function createRustExtensions(
  filePath: string,
  workspaceRoot: string
): Promise<Extension[]> {
  // 初始化 LSP
  const initialized = await initializeRustLSP(workspaceRoot);
  if (!initialized) {
    console.warn('[Rust LSP] Failed to initialize, LSP features disabled');
    return [];
  }

  return [
    // 补全
    autocompletion({
      override: [createRustCompletionSource(filePath)],
    }),
    // 诊断
    createRustLinter(filePath),
    // 点击跳转 - 使用自定义事件
    EditorView.domEventHandlers({
      click: (event, _view) => {
        // Ctrl+点击跳转定义
        if (event.ctrlKey || event.metaKey) {
          const view = _view; // Reassign to avoid unused variable
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos === null) return false;

          const line = view.state.doc.lineAt(pos);
          const lineNo = line.number - 1;
          const character = pos - line.from;

          gotoDefinition(filePath, lineNo, character).then((location) => {
            if (location) {
              window.dispatchEvent(
                new CustomEvent('lsp:goto-definition', {
                  detail: {
                    uri: location.uri,
                    line: location.range.start.line,
                    character: location.range.start.character,
                  },
                })
              );
            }
          });
          return true;
        }
        return false;
      },
    }),
  ];
}

/**
 * 清理 Rust LSP
 */
export function cleanupRustLSP(): void {
  shutdownRustLSP().catch(console.error);
}
