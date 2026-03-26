/**
 * ExecutionTab - 执行记录标签页
 */

import { Clock, CheckCircle, XCircle, Play, FileCode, Timer } from 'lucide-react'
import clsx from 'clsx'
import type { RequirementExecution } from '@/types/requirement'
import { RequirementStatusLabels } from '@/types/requirement'

interface ExecutionTabProps {
  executions: RequirementExecution[]
  activeExecutionId?: string | null
}

export function ExecutionTab({ executions, activeExecutionId }: ExecutionTabProps) {
  if (executions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-text-muted">
        <Play size={32} className="mb-2 opacity-30" />
        <span className="text-xs">暂无执行记录</span>
        <span className="text-[10px] mt-1">需求进入开发/测试阶段后将显示执行记录</span>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="space-y-2">
        {[...executions].reverse().map((exec) => (
          <ExecutionCard
            key={exec.id}
            execution={exec}
            isActive={exec.id === activeExecutionId}
          />
        ))}
      </div>
    </div>
  )
}

function ExecutionCard({ execution: exec, isActive }: { execution: RequirementExecution; isActive: boolean }) {
  const duration = exec.finishedAt && exec.startedAt
    ? ((exec.finishedAt - exec.startedAt) / 1000).toFixed(1)
    : null

  return (
    <div
      className={clsx(
        'p-3 rounded-lg border transition-all',
        isActive
          ? 'bg-primary/5 border-primary/30'
          : 'bg-background-surface border-border-subtle'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ExecutionStatusIcon status={exec.status} />
          <span className="text-xs font-medium text-text-primary">
            {actionLabels[exec.action] || exec.action}
          </span>
          <span className="text-[10px] text-text-muted">
            @{RequirementStatusLabels[exec.phase as keyof typeof RequirementStatusLabels] || exec.phase}
          </span>
          {isActive && (
            <span className="text-[10px] text-amber-400 animate-pulse">运行中</span>
          )}
        </div>

        {duration && (
          <div className="flex items-center gap-1 text-[10px] text-text-muted">
            <Timer size={10} />
            <span>{duration}s</span>
          </div>
        )}
      </div>

      {/* 摘要 */}
      {exec.summary && (
        <div className="mt-2 text-xs text-text-primary whitespace-pre-wrap bg-background-tertiary/30 rounded p-1.5">
          {exec.summary}
        </div>
      )}

      {/* 错误 */}
      {exec.error && (
        <div className="mt-2 text-xs text-red-400 bg-red-500/5 rounded p-1.5">
          {exec.error}
        </div>
      )}

      {/* 变更文件 */}
      {exec.changedFiles && exec.changedFiles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <FileCode size={10} className="text-text-muted" />
          {exec.changedFiles.slice(0, 5).map((file) => (
            <span key={file} className="px-1 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 rounded font-mono">
              {file.split('/').pop()}
            </span>
          ))}
          {exec.changedFiles.length > 5 && (
            <span className="text-[10px] text-text-muted">+{exec.changedFiles.length - 5}</span>
          )}
        </div>
      )}

      {/* 元信息 */}
      <div className="mt-2 flex items-center gap-3 text-[10px] text-text-muted">
        <span>{new Date(exec.startedAt * 1000).toLocaleString('zh-CN')}</span>
        {exec.toolCallCount !== undefined && exec.toolCallCount > 0 && (
          <span>{exec.toolCallCount} 次工具调用</span>
        )}
        {exec.tokenCount !== undefined && exec.tokenCount > 0 && (
          <span>{exec.tokenCount} tokens</span>
        )}
      </div>
    </div>
  )
}

function ExecutionStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Clock size={12} className="text-amber-400 animate-spin" />
    case 'success':
      return <CheckCircle size={12} className="text-green-400" />
    case 'failed':
      return <XCircle size={12} className="text-red-400" />
    default:
      return <Clock size={12} className="text-text-muted" />
  }
}

const actionLabels: Record<string, string> = {
  analyze: '需求分析',
  design: '方案设计',
  develop: '开发实现',
  test: '测试验证',
  fix: 'Bug 修复',
}
