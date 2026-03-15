/**
 * LSP 设置 Tab
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button, Switch } from '../../Common';
import { IconLoading, IconCompleted, IconFailed } from '../../Common/Icons';
import type { LSPServerStatus, LSPServerType } from '../../../types/lsp';

interface ServerStatus {
  status: LSPServerStatus;
  path?: string;
  version?: string;
  error?: string;
}

interface LSPServerConfig {
  id: LSPServerType;
  name: string;
  description: string;
  installHint: string;
}

const LSP_SERVERS: LSPServerConfig[] = [
  {
    id: 'typescript',
    name: 'TypeScript',
    description: 'TypeScript/JavaScript 智能补全、类型检查',
    installHint: '内置 WASM 版本，无需安装',
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    description: 'JavaScript 智能补全、语法检查',
    installHint: '内置 WASM 版本，无需安装',
  },
  {
    id: 'rust',
    name: 'Rust',
    description: 'Rust 智能补全、类型检查、跳转定义',
    installHint: '运行 rustup component add rust-analyzer 安装',
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Python 智能补全、代码检查',
    installHint: '暂未支持',
  },
];

export function LSPTab() {
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [enabledServers, setEnabledServers] = useState<Record<string, boolean>>({
    typescript: true,
    javascript: true,
    rust: false,
    python: false,
  });

  // 检查所有服务器状态
  const checkAllServers = async () => {
    for (const server of LSP_SERVERS) {
      try {
        const result = await invoke<ServerStatus>('lsp_check_server', {
          language: server.id,
        });
        setServerStatuses((prev) => ({
          ...prev,
          [server.id]: result,
        }));
      } catch (error) {
        console.error(`Failed to check ${server.id} status:`, error);
      }
    }
  };

  useEffect(() => {
    checkAllServers();
  }, []);

  // 安装服务器
  const handleInstall = async (serverId: string) => {
    setLoading((prev) => ({ ...prev, [serverId]: true }));
    try {
      await invoke('lsp_install_server', { language: serverId });
      await checkAllServers();
    } catch (error) {
      console.error(`Failed to install ${serverId}:`, error);
    } finally {
      setLoading((prev) => ({ ...prev, [serverId]: false }));
    }
  };

  // 卸载服务器
  const handleUninstall = async (serverId: string) => {
    setLoading((prev) => ({ ...prev, [serverId]: true }));
    try {
      await invoke('lsp_uninstall_server', { language: serverId });
      await checkAllServers();
    } catch (error) {
      console.error(`Failed to uninstall ${serverId}:`, error);
    } finally {
      setLoading((prev) => ({ ...prev, [serverId]: false }));
    }
  };

  // 切换服务器启用状态
  const handleToggle = (serverId: string, enabled: boolean) => {
    setEnabledServers((prev) => ({
      ...prev,
      [serverId]: enabled,
    }));
  };

  // 获取状态图标
  const getStatusIcon = (status?: LSPServerStatus) => {
    switch (status) {
      case 'installed':
      case 'running':
        return <IconCompleted size={14} className="text-success" />;
      case 'installing':
      case 'starting':
        return <IconLoading size={14} className="text-primary" />;
      case 'error':
        return <IconFailed size={14} className="text-danger" />;
      default:
        return <div className="w-3.5 h-3.5 rounded-full bg-text-muted/30" />;
    }
  };

  // 获取状态文本
  const getStatusText = (status?: LSPServerStatus) => {
    switch (status) {
      case 'installed':
        return '已安装';
      case 'running':
        return '运行中';
      case 'installing':
        return '安装中...';
      case 'starting':
        return '启动中...';
      case 'error':
        return '错误';
      case 'not_installed':
        return '未安装';
      default:
        return '检测中...';
    }
  };

  return (
    <div className="space-y-6">
      {/* 说明 */}
      <div className="p-4 bg-surface rounded-lg border border-border-subtle">
        <h4 className="text-sm font-medium text-text-primary mb-2">LSP 智能功能</h4>
        <p className="text-xs text-text-secondary">
          Language Server Protocol 提供代码补全、错误诊断、跳转定义等 IDE 级功能。
          TypeScript/JavaScript 使用内置 WASM 版本，Rust 需要 rust-analyzer。
        </p>
      </div>

      {/* 服务器列表 */}
      <div className="space-y-3">
        {LSP_SERVERS.map((server) => {
          const status = serverStatuses[server.id];
          const isLoading = loading[server.id];
          const isEnabled = enabledServers[server.id];
          const isBundled = server.id === 'typescript' || server.id === 'javascript';
          const isInstalled = status?.status === 'installed' || status?.status === 'running';

          return (
            <div
              key={server.id}
              className="p-4 bg-surface rounded-lg border border-border-subtle"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status?.status)}
                    <h4 className="text-sm font-medium text-text-primary">
                      {server.name}
                    </h4>
                    <span className="text-xs text-text-tertiary">
                      {getStatusText(status?.status)}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    {server.description}
                  </p>
                  {status?.version && (
                    <p className="text-xs text-text-tertiary mt-1">
                      版本: {status.version}
                    </p>
                  )}
                  {status?.error && (
                    <p className="text-xs text-danger mt-1">
                      {status.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* 启用开关 */}
                  <Switch
                    checked={isEnabled}
                    onChange={(checked) => handleToggle(server.id, checked)}
                    disabled={!isInstalled && !isBundled}
                  />

                  {/* 安装/卸载按钮 */}
                  {!isBundled && (
                    <div className="flex gap-2">
                      {!isInstalled ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleInstall(server.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? '安装中...' : '安装'}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUninstall(server.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? '卸载中...' : '卸载'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 安装提示 */}
              {!isInstalled && !isBundled && (
                <div className="mt-3 p-2 bg-background-base rounded text-xs text-text-tertiary">
                  💡 {server.installHint}
                </div>
              )}

              {/* 内置说明 */}
              {isBundled && (
                <div className="mt-3 p-2 bg-primary/5 rounded text-xs text-primary/80">
                  ✓ {server.installHint}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 刷新按钮 */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={checkAllServers}>
          刷新状态
        </Button>
      </div>
    </div>
  );
}
