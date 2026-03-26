/**
 * OverviewTab - 需求概览标签页
 */

import { useState } from 'react'
import { Plus, Trash2, Check, ChevronRight, Calendar } from 'lucide-react'
import type { Requirement } from '@/types/requirement'
import { RequirementTypeLabels, RequirementPriorityLabels, VALID_TRANSITIONS, RequirementStatusLabels } from '@/types/requirement'
import { PhaseBadge } from '../PhaseBadge'
import clsx from 'clsx'

interface OverviewTabProps {
  requirement: Requirement
  onTransition: (targetStatus: Requirement['status'], reason?: string) => void
  onAddSub: (title: string) => void
  onToggleSub: (subId: string) => void
  onDeleteSub: (subId: string) => void
}

export function OverviewTab({
  requirement: req,
  onTransition,
  onAddSub,
  onToggleSub,
  onDeleteSub,
}: OverviewTabProps) {
  const [newSubTitle, setNewSubTitle] = useState('')
  const [showSubInput, setShowSubInput] = useState(false)

  const nextStatuses = VALID_TRANSITIONS[req.status] || []
  const completedSubs = req.subRequirements?.filter((s) => s.status === 'completed').length || 0
  const totalSubs = req.subRequirements?.length || 0
  const subProgress = totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0

  const handleAddSub = () => {
    if (newSubTitle.trim()) {
      onAddSub(newSubTitle.trim())
      setNewSubTitle('')
      setShowSubInput(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* 基本信息 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-secondary">类型:</span>
          <span className="text-xs text-text-primary">{RequirementTypeLabels[req.type]}</span>
          <span className="text-xs text-text-secondary">优先级:</span>
          <span className="text-xs text-text-primary">{RequirementPriorityLabels[req.priority]}</span>
        </div>

        {req.group && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">分组:</span>
            <span className="text-xs text-text-primary">{req.group}</span>
          </div>
        )}

        {req.dueDate && (
          <div className="flex items-center gap-2">
            <Calendar size={12} className="text-text-secondary" />
            <span className="text-xs text-text-primary">
              截止: {new Date(req.dueDate).toLocaleDateString('zh-CN')}
            </span>
          </div>
        )}

        {req.dependencies && req.dependencies.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">依赖:</span>
            <span className="text-xs text-blue-400">{req.dependencies.length} 个需求</span>
          </div>
        )}
      </div>

      {/* 描述 */}
      {req.description && (
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-1">描述</h3>
          <div className="text-xs text-text-primary whitespace-pre-wrap bg-background-tertiary/50 rounded-md p-2">
            {req.description}
          </div>
        </div>
      )}

      {/* 标签 */}
      {req.tags && req.tags.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-1">标签</h3>
          <div className="flex flex-wrap gap-1">
            {req.tags.map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-background-tertiary rounded text-text-secondary">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 相关文件 */}
      {req.relatedFiles && req.relatedFiles.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-1">相关文件</h3>
          <div className="flex flex-wrap gap-1">
            {req.relatedFiles.map((file) => (
              <span key={file} className="px-1.5 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 rounded font-mono">
                {file.split('/').pop()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 子需求 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-text-secondary">子需求</h3>
          <button
            onClick={() => setShowSubInput(!showSubInput)}
            className="p-1 rounded hover:bg-background-hover text-text-secondary hover:text-primary transition-all"
          >
            <Plus size={12} />
          </button>
        </div>

        {showSubInput && (
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              placeholder="子需求标题..."
              value={newSubTitle}
              onChange={(e) => setNewSubTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSub()}
              className="flex-1 px-2 py-1 text-xs bg-background-tertiary border border-border-subtle rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50"
              autoFocus
            />
            <button onClick={handleAddSub} className="p-1 text-primary hover:bg-primary/10 rounded">
              <Check size={12} />
            </button>
          </div>
        )}

        {totalSubs > 0 && (
          <>
            <div className="flex items-center gap-2 mb-2 text-xs text-text-secondary">
              <div className="flex-1 bg-background-tertiary rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${subProgress}%` }}
                />
              </div>
              <span className="whitespace-nowrap">
                {completedSubs}/{totalSubs} ({Math.round(subProgress)}%)
              </span>
            </div>
            <div className="space-y-1">
              {req.subRequirements?.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-2 px-2 py-1 rounded bg-background-surface group"
                >
                  <button onClick={() => onToggleSub(sub.id)} className="flex-shrink-0">
                    <div
                      className={clsx(
                        'w-3.5 h-3.5 rounded border flex items-center justify-center transition-all',
                        sub.status === 'completed'
                          ? 'bg-primary border-primary'
                          : 'border-border-subtle'
                      )}
                    >
                      {sub.status === 'completed' && <Check size={10} className="text-white" />}
                    </div>
                  </button>
                  <span
                    className={clsx(
                      'flex-1 text-xs',
                      sub.status === 'completed'
                        ? 'text-text-muted line-through'
                        : 'text-text-primary'
                    )}
                  >
                    {sub.title}
                  </span>
                  <button
                    onClick={() => onDeleteSub(sub.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted hover:text-red-500 transition-all"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 状态流转 */}
      <div>
        <h3 className="text-xs font-medium text-text-secondary mb-2">
          状态流转 <PhaseBadge status={req.status} size="md" />
        </h3>
        {nextStatuses.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {nextStatuses.map((nextStatus) => (
              <button
                key={nextStatus}
                onClick={() => onTransition(nextStatus)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] border border-border-subtle rounded hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all text-text-secondary"
              >
                <ChevronRight size={10} />
                {RequirementStatusLabels[nextStatus]}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-text-muted">终态，无可用的状态转换</span>
        )}
      </div>
    </div>
  )
}
