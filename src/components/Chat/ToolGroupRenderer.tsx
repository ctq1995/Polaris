/**
 * ToolGroup 渲染器组件
 *
 * 用于聚合展示多个相关工具调用
 */

import { memo, useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { ToolCallBlock } from '../../types';
import { formatDuration } from '../../utils/toolSummary';
import { getToolConfig } from '../../utils/toolConfig';
import { Check, XCircle, Loader2, AlertTriangle, ChevronDown, ChevronRight, Circle } from 'lucide-react';
import type { MessageRenderMode } from '../../utils/messageLayer';

// ========================================
// 类型定义
// ========================================

export type ToolGroupStatus = 'completed' | 'failed' | 'partial' | 'running' | 'pending';

export interface ToolGroupRendererProps {
  tools: ToolCallBlock[];
  renderMode?: MessageRenderMode;
}

// ========================================
// 状态配置
// ========================================

const STATUS_CONFIG: Record<ToolGroupStatus, { icon: typeof Check; className: string; bgClass: string }> = {
  completed: { icon: Check, className: 'text-success', bgClass: 'bg-success-faint border-success/30' },
  failed: { icon: XCircle, className: 'text-error', bgClass: 'bg-error-faint border-error/30' },
  partial: { icon: AlertTriangle, className: 'text-warning', bgClass: 'bg-warning-faint border-warning/30' },
  running: { icon: Loader2, className: 'text-primary animate-spin', bgClass: 'bg-primary-faint border-primary/30' },
  pending: { icon: Circle, className: 'text-text-muted', bgClass: 'bg-bg-secondary border-border' },
};

const TOOL_STATUS_CONFIG: Record<string, { icon: typeof Check; className: string }> = {
  completed: { icon: Check, className: 'text-success' },
  failed: { icon: XCircle, className: 'text-error' },
  partial: { icon: AlertTriangle, className: 'text-warning' },
  running: { icon: Loader2, className: 'text-primary animate-spin' },
  pending: { icon: Circle, className: 'text-text-muted' },
};

// ========================================
// ToolGroup 渲染器
// ========================================

/**
 * ToolGroup 组件 - 用于聚合展示多个工具调用
 */
export const ToolGroupRenderer = memo(function ToolGroupRenderer({
  tools,
  renderMode = 'full',
}: ToolGroupRendererProps) {
  const { t } = useTranslation('chat');
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsExpanded(prev => !prev);
    }
  }, []);

  // 计算组状态
  const groupStatus = useMemo((): ToolGroupStatus => {
    const allCompleted = tools.every(t => t.status === 'completed');
    const anyFailed = tools.some(t => t.status === 'failed');
    const anyRunning = tools.some(t => t.status === 'running' || t.status === 'pending');

    if (allCompleted) return 'completed';
    if (anyFailed && !anyRunning) return 'failed';
    if (anyFailed) return 'partial';
    if (anyRunning) return 'running';
    return 'pending';
  }, [tools]);

  // 统计各状态数量
  const stats = useMemo(() => {
    const completed = tools.filter(t => t.status === 'completed').length;
    const failed = tools.filter(t => t.status === 'failed').length;
    const running = tools.filter(t => t.status === 'running' || t.status === 'pending').length;
    return { completed, failed, running };
  }, [tools]);

  // 获取状态配置
  const statusConfig = STATUS_CONFIG[groupStatus] || STATUS_CONFIG.pending;

  // 生成摘要
  const summary = useMemo(() => {
    const toolNames = [...new Set(tools.map(t => t.name))];
    if (toolNames.length === 1) {
      return `${toolNames[0]} ×${tools.length}`;
    }
    return `${tools.length} ${t('toolGroup.tools')}`;
  }, [tools, t]);

  // 计算总时长
  const duration = useMemo(() => {
    const firstStart = tools[0]?.startedAt;
    const lastEnd = tools.filter(t => t.completedAt).pop()?.completedAt;
    if (firstStart && lastEnd) {
      const ms = new Date(lastEnd).getTime() - new Date(firstStart).getTime();
      return formatDuration(ms);
    }
    return null;
  }, [tools]);

  const StatusIcon = statusConfig.icon;

  // 归档模式：简化渲染
  if (renderMode === 'archive') {
    return (
      <div className="my-1 flex items-center gap-2 text-xs text-text-tertiary">
        <StatusIcon className={clsx('w-3 h-3', statusConfig.className)} />
        <span className="truncate">{summary}</span>
        {stats.completed > 0 && <span className="text-success">{stats.completed}</span>}
        {stats.failed > 0 && <span className="text-error">{stats.failed}</span>}
      </div>
    );
  }

  // 默认最多显示 3 个工具
  const displayedTools = isExpanded ? tools : tools.slice(0, 3);
  const hasMoreTools = tools.length > 3;

  return (
    <div
      ref={containerRef}
      className="my-2"
      role="region"
      aria-label={t('toolGroup.ariaLabel', { count: tools.length })}
    >
      {/* 工具组摘要 */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={t('toolGroup.toggleLabel')}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all hover:shadow-medium',
          'focus:ring-2 focus:ring-primary focus:outline-none',
          statusConfig.bgClass
        )}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={handleKeyDown}
      >
        {/* 状态图标 */}
        <StatusIcon className={clsx('w-4 h-4 shrink-0', statusConfig.className)} />

        {/* 摘要内容 */}
        <div className="flex-1">
          <span className={clsx(
            'text-sm',
            groupStatus === 'running' ? 'text-text-primary' : 'text-text-secondary'
          )}>
            {summary}
          </span>

          {/* 状态统计 */}
          <span className="ml-2 text-xs text-text-tertiary">
            {stats.completed > 0 && `${stats.completed} ${t('toolGroup.completed')} `}
            {stats.running > 0 && `${stats.running} ${t('toolGroup.running')} `}
            {stats.failed > 0 && `${stats.failed} ${t('toolGroup.failed')}`}
          </span>
        </div>

        {/* 时长 */}
        {duration && (
          <span className="text-xs text-text-tertiary">
            {duration}
          </span>
        )}

        {/* 展开/折叠图标 */}
        <div className="shrink-0 text-text-subtle">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      {/* 展开后的工具列表 */}
      {isExpanded && tools.length > 0 && (
        <div className="mt-2 ml-4 space-y-1.5">
          {displayedTools.map((tool) => {
            const toolConfig = getToolConfig(tool.name);
            const ToolIcon = toolConfig.icon;
            const toolStatusConfig = TOOL_STATUS_CONFIG[tool.status] || TOOL_STATUS_CONFIG.pending;
            const ToolStatusIcon = toolStatusConfig.icon;

            return (
              <div
                key={tool.id}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-bg-secondary/50 border border-border-subtle"
              >
                <ToolIcon className={clsx('w-3.5 h-3.5 shrink-0', toolConfig.color)} />
                <span className="text-sm text-text-secondary flex-1 truncate">
                  {toolConfig.label}
                </span>
                <ToolStatusIcon className={clsx('w-3 h-3 shrink-0', toolStatusConfig.className)} />
              </div>
            );
          })}

          {/* 显示更多按钮 */}
          {hasMoreTools && !isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              className="w-full px-3 py-2 text-xs text-primary hover:text-primary-hover hover:bg-bg-hover rounded-md transition-colors"
            >
              {t('toolGroup.showAll', { count: tools.length })}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// ========================================
// 简化渲染器（归档模式）
// ========================================

export const SimplifiedToolGroupRenderer = memo(function SimplifiedToolGroupRenderer({
  tools,
}: {
  tools: ToolCallBlock[];
}) {
  const { t } = useTranslation('chat');

  // 计算组状态
  const groupStatus = useMemo((): ToolGroupStatus => {
    const allCompleted = tools.every(t => t.status === 'completed');
    const anyFailed = tools.some(t => t.status === 'failed');
    const anyRunning = tools.some(t => t.status === 'running' || t.status === 'pending');

    if (allCompleted) return 'completed';
    if (anyFailed && !anyRunning) return 'failed';
    if (anyFailed) return 'partial';
    if (anyRunning) return 'running';
    return 'pending';
  }, [tools]);

  // 生成摘要
  const summary = useMemo(() => {
    const toolNames = [...new Set(tools.map(t => t.name))];
    if (toolNames.length === 1) {
      return `${toolNames[0]} ×${tools.length}`;
    }
    return `${tools.length} ${t('toolGroup.tools')}`;
  }, [tools, t]);

  // 统计
  const stats = useMemo(() => {
    const completed = tools.filter(t => t.status === 'completed').length;
    const failed = tools.filter(t => t.status === 'failed').length;
    return { completed, failed };
  }, [tools]);

  const statusConfig = STATUS_CONFIG[groupStatus] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className="my-1 flex items-center gap-2 text-xs text-text-tertiary"
      aria-label={t('toolGroup.ariaLabel', { count: tools.length })}
      aria-hidden="true"
    >
      <StatusIcon className={clsx('w-3 h-3', statusConfig.className)} />
      <span className="truncate">{summary}</span>
      {stats.completed > 0 && <span className="text-success">{stats.completed}</span>}
      {stats.failed > 0 && <span className="text-error">{stats.failed}</span>}
    </div>
  );
});

// 导出状态配置供测试使用
export { STATUS_CONFIG, TOOL_STATUS_CONFIG };
