/**
 * LSP (Language Server Protocol) 相关类型定义
 */

/** LSP 服务器状态 */
export type LSPServerStatus = 'not_installed' | 'installing' | 'installed' | 'starting' | 'running' | 'error';

/** LSP 服务器类型 */
export type LSPServerType = 'typescript' | 'javascript' | 'rust' | 'python';

/** LSP 服务器配置 */
export interface LSPServerConfig {
  /** 服务器类型 */
  type: LSPServerType;
  /** 是否启用 */
  enabled: boolean;
  /** 当前状态 */
  status: LSPServerStatus;
  /** 安装方式 */
  installMethod: 'bundled' | 'system' | 'manual';
  /** 版本号 */
  version?: string;
  /** 可执行路径 */
  path?: string;
  /** 错误信息 */
  error?: string;
}

/** LSP 配置 */
export interface LSPConfig {
  /** 是否启用 LSP 功能 */
  enabled: boolean;
  /** 各语言服务器配置 */
  servers: Record<LSPServerType, LSPServerConfig>;
}

/** LSP 位置信息 */
export interface LSPLocation {
  /** 文件 URI */
  uri: string;
  /** 范围 */
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

/** LSP 补全项 */
export interface LSPCompletionItem {
  /** 标签（显示文本） */
  label: string;
  /** 类型 */
  kind: number;
  /** 详情 */
  detail?: string;
  /** 文档 */
  documentation?: string;
  /** 插入文本 */
  insertText: string;
}

/** LSP 诊断信息 */
export interface LSPDiagnostic {
  /** 范围 */
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  /** 严重程度：1=Error, 2=Warning, 3=Information, 4=Hint */
  severity: 1 | 2 | 3 | 4;
  /** 消息 */
  message: string;
  /** 来源 */
  source?: string;
}

/** 默认 LSP 配置 */
export const defaultLSPConfig: LSPConfig = {
  enabled: true,
  servers: {
    typescript: {
      type: 'typescript',
      enabled: true,
      status: 'installed', // WASM 版本始终已安装
      installMethod: 'bundled',
    },
    javascript: {
      type: 'javascript',
      enabled: true,
      status: 'installed', // WASM 版本始终已安装
      installMethod: 'bundled',
    },
    rust: {
      type: 'rust',
      enabled: false,
      status: 'not_installed',
      installMethod: 'system',
    },
    python: {
      type: 'python',
      enabled: false,
      status: 'not_installed',
      installMethod: 'system',
    },
  },
};
