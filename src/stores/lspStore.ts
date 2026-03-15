/**
 * LSP 状态管理
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { LSPConfig, LSPServerConfig, LSPServerType, LSPServerStatus } from '../types/lsp';
import { defaultLSPConfig } from '../types/lsp';

interface LSPStoreState {
  /** LSP 配置 */
  config: LSPConfig;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 当前活动的 LSP 客户端（按语言类型） */
  activeClients: Record<string, boolean>;
}

interface LSPStoreActions {
  /** 初始化 LSP */
  initialize: () => Promise<void>;
  /** 更新服务器配置 */
  updateServerConfig: (type: LSPServerType, config: Partial<LSPServerConfig>) => void;
  /** 启用/禁用服务器 */
  toggleServer: (type: LSPServerType, enabled: boolean) => void;
  /** 检查服务器状态 */
  checkServerStatus: (type: LSPServerType) => Promise<LSPServerStatus>;
  /** 安装服务器 */
  installServer: (type: LSPServerType) => Promise<void>;
  /** 卸载服务器 */
  uninstallServer: (type: LSPServerType) => Promise<void>;
  /** 启动服务器 */
  startServer: (type: LSPServerType, workspaceRoot: string) => Promise<void>;
  /** 停止服务器 */
  stopServer: (type: LSPServerType) => Promise<void>;
  /** 设置错误 */
  setError: (error: string | null) => void;
  /** 设置客户端活动状态 */
  setClientActive: (type: string, active: boolean) => void;
  /** 更新配置 */
  updateConfig: (config: Partial<LSPConfig>) => void;
}

export type LSPStore = LSPStoreState & LSPStoreActions;

export const useLSPStore = create<LSPStore>((set, get) => ({
  config: defaultLSPConfig,
  loading: false,
  error: null,
  activeClients: {},

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      // 检查各语言服务器状态
      const { config } = get();

      // TypeScript/JavaScript 使用 WASM，始终可用
      // Rust 和 Python 需要检查系统安装

      if (config.servers.rust.enabled) {
        await get().checkServerStatus('rust');
      }

      if (config.servers.python.enabled) {
        await get().checkServerStatus('python');
      }

      set({ loading: false });
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },

  updateServerConfig: (type, serverConfig) => {
    set((state) => ({
      config: {
        ...state.config,
        servers: {
          ...state.config.servers,
          [type]: {
            ...state.config.servers[type],
            ...serverConfig,
          },
        },
      },
    }));
  },

  toggleServer: (type, enabled) => {
    set((state) => ({
      config: {
        ...state.config,
        servers: {
          ...state.config.servers,
          [type]: {
            ...state.config.servers[type],
            enabled,
          },
        },
      },
    }));
  },

  checkServerStatus: async (type) => {
    // TypeScript/JavaScript 使用 WASM，始终已安装
    if (type === 'typescript' || type === 'javascript') {
      set((state) => ({
        config: {
          ...state.config,
          servers: {
            ...state.config.servers,
            [type]: {
              ...state.config.servers[type],
              status: 'installed',
            },
          },
        },
      }));
      return 'installed';
    }

    // Rust 和 Python 需要调用后端检查
    try {
      const result = await invoke<{ status: LSPServerStatus; path?: string; version?: string; error?: string }>(
        'lsp_check_server',
        { language: type }
      );

      set((state) => ({
        config: {
          ...state.config,
          servers: {
            ...state.config.servers,
            [type]: {
              ...state.config.servers[type],
              status: result.status,
              path: result.path,
              version: result.version,
              error: result.error,
            },
          },
        },
      }));

      return result.status;
    } catch (error) {
      set((state) => ({
        config: {
          ...state.config,
          servers: {
            ...state.config.servers,
            [type]: {
              ...state.config.servers[type],
              status: 'error',
              error: String(error),
            },
          },
        },
      }));
      return 'error';
    }
  },

  installServer: async (type) => {
    set((state) => ({
      config: {
        ...state.config,
        servers: {
          ...state.config.servers,
          [type]: {
            ...state.config.servers[type],
            status: 'installing',
          },
        },
      },
    }));

    try {
      const result = await invoke<{ success: boolean; error?: string }>('lsp_install_server', {
        language: type,
      });

      if (result.success) {
        await get().checkServerStatus(type);
      } else {
        set((state) => ({
          config: {
            ...state.config,
            servers: {
              ...state.config.servers,
              [type]: {
                ...state.config.servers[type],
                status: 'error',
                error: result.error || 'Installation failed',
              },
            },
          },
        }));
      }
    } catch (error) {
      set((state) => ({
        config: {
          ...state.config,
          servers: {
            ...state.config.servers,
            [type]: {
              ...state.config.servers[type],
              status: 'error',
              error: String(error),
            },
          },
        },
      }));
    }
  },

  uninstallServer: async (type) => {
    try {
      await invoke('lsp_uninstall_server', { language: type });
      await get().checkServerStatus(type);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  startServer: async (type, workspaceRoot) => {
    set((state) => ({
      config: {
        ...state.config,
        servers: {
          ...state.config.servers,
          [type]: {
            ...state.config.servers[type],
            status: 'starting',
          },
        },
      },
    }));

    try {
      await invoke('lsp_start_server', { language: type, workspaceRoot });
      set((state) => ({
        config: {
          ...state.config,
          servers: {
            ...state.config.servers,
            [type]: {
              ...state.config.servers[type],
              status: 'running',
            },
          },
        },
        activeClients: {
          ...state.activeClients,
          [type]: true,
        },
      }));
    } catch (error) {
      set((state) => ({
        config: {
          ...state.config,
          servers: {
            ...state.config.servers,
            [type]: {
              ...state.config.servers[type],
              status: 'error',
              error: String(error),
            },
          },
        },
      }));
    }
  },

  stopServer: async (type) => {
    try {
      await invoke('lsp_stop_server', { language: type });
      set((state) => ({
        config: {
          ...state.config,
          servers: {
            ...state.config.servers,
            [type]: {
              ...state.config.servers[type],
              status: 'installed',
            },
          },
        },
        activeClients: {
          ...state.activeClients,
          [type]: false,
        },
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  setError: (error) => set({ error }),

  setClientActive: (type, active) => {
    set((state) => ({
      activeClients: {
        ...state.activeClients,
        [type]: active,
      },
    }));
  },

  updateConfig: (config) => {
    set((state) => ({
      config: {
        ...state.config,
        ...config,
      },
    }));
  },
}));
