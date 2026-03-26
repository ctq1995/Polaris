/**
 * RequirementCard - 需求列表卡片
 */

import { Clock, Edit, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import type { Requirement } from '@/types/requirement'
import { RequirementTypeLabels, RequirementPriorityLabels } from '@/types/requirement'
import { PhaseBadge } from './PhaseBadge'

interface RequirementCardProps {
  requirement: Requirement
  isSelected: boolean
  onClick: (req: Requirement) => void
  onEdit?: (req: Requirement) => void
  onDelete?: (req: Requirement) => void
}

const priorityColors: Record<string, string> = {
  urgent: 'text-red-400',
  high: 'text-orange-400',
  normal: 'text-text-secondary',
  low: 'text-text-muted',
}

const typeColors: Record<string, string> = {
  feature: 'text-blue-400',
  bugfix: 'text-red-400',
  refactor: 'text-purple-400',
  docs: 'text-green-400',
  infra: 'text-yellow-400',
  research: 'text-cyan-400',
  other: 'text-text-secondary',
}

export function RequirementCard({
  requirement: req,
  isSelected,
  onClick,
  onEdit,
  onDelete,
}: RequirementCardProps) {
  const completedSubs = req.subRequirements?.filter((s) => s.status === 'completed').length || 0
  const totalSubs = req.subRequirements?.length || 0
  const subProgress = totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0

  return (
    <div
      onClick={() => onClick(req)}
      className={clsx(
        'p-3 rounded-lg border transition-all cursor-pointer',
        isSelected
          ? 'bg-primary/10 border-primary/40 shadow-sm'
          : 'bg-background-surface border-border-subtle hover:border-border hover:bg-background-hover'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary truncate max-w-[200px]">
              {req.title}
            </span>
            <PhaseBadge status={req.status} />
          </div>

          <div className="flex items-center gap-2 mt-1.5 text-[10px]">
            <span className={typeColors[req.type] || 'text-text-secondary'}>
              {RequirementTypeLabels[req.type]}
            </span>
            <span className="text-border">|</span>
            <span className={priorityColors[req.priority]}>
              {RequirementPriorityLabels[req.priority]}
            </span>
            {req.group && (
              <>
                <span className="text-border">|</span>
                <span className="text-text-muted">{req.group}</span>
              </>
            )}
          </div>

          {/* 子需求进度 */}
          {totalSubs > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
              <div className="flex-1 bg-background-tertiary rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${subProgress}%` }}
                />
              </div>
              <span className="whitespace-nowrap text-[10px]">
                {completedSubs}/{totalSubs}
              </span>
            </div>
          )}

          {/* 执行信息 */}
          {req.activeExecutionId && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400">
              <Clock size={10} className="animate-spin" />
              <span>执行中</span>
            </div>
          )}

          {req.tags && req.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {req.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 text-[10px] text-text-muted bg-background-tertiary rounded"
                >
                  {tag}
                </span>
              ))}
              {req.tags.length > 3 && (
                <span className="text-[10px] text-text-muted">+{req.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-1">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(req)
              }}
              className="p-1 rounded hover:bg-background-hover text-text-secondary hover:text-text-primary transition-all"
            >
              <Edit size={12} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`确定删除需求「${req.title}」？`)) {
                  onDelete(req)
                }
              }}
              className="p-1 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-500 transition-all"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 时间 */}
      <div className="mt-2 text-[10px] text-text-muted">
        {new Date(req.createdAt * 1000).toLocaleDateString('zh-CN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  )
}
