/**
 * RequirementList - 需求列表（左侧栏）
 */

import { useState, useMemo } from 'react'
import { Search, Plus, Filter, Bot, CheckCircle2 } from 'lucide-react'
import type { Requirement, RequirementFilter, RequirementStatus, RequirementPriority, RequirementType } from '@/types/requirement'
import { RequirementStatusLabels, RequirementPriorityLabels, RequirementTypeLabels } from '@/types/requirement'
import { RequirementCard } from './RequirementCard'

interface RequirementListProps {
  requirements: Requirement[]
  selectedId: string | null
  stats: { total: number; completionRate: number } | null
  filter: RequirementFilter
  onSelect: (req: Requirement) => void
  onEdit: (req: Requirement) => void
  onDelete: (req: Requirement) => void
  onCreate: () => void
  onFilterChange: (filter: Partial<RequirementFilter>) => void
  loading?: boolean
  onAIExplore?: () => void
  onBatchApprove?: (ids: string[]) => void
}

export function RequirementList({
  requirements,
  selectedId,
  stats,
  filter,
  onSelect,
  onEdit,
  onDelete,
  onCreate,
  onFilterChange,
  loading,
  onAIExplore,
  onBatchApprove,
}: RequirementListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilter, setShowFilter] = useState(false)

  const filteredRequirements = useMemo(() => {
    let result = [...requirements]

    // 搜索
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.tags?.some((t) => t.toLowerCase().includes(q))
      )
    }

    // 状态筛选
    if (filter.status && filter.status !== 'all') {
      result = result.filter((r) => r.status === filter.status)
    }

    // 优先级筛选
    if (filter.priority) {
      result = result.filter((r) => r.priority === filter.priority)
    }

    // 类型筛选
    if (filter.type) {
      result = result.filter((r) => r.type === filter.type)
    }

    return result
  }, [requirements, searchQuery, filter])

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="p-3 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-text-primary">需求库</h2>
          <div className="flex items-center gap-1">
            {onAIExplore && (
              <button
                onClick={onAIExplore}
                className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                title="AI 探索代码库，自动补充需求"
              >
                <Bot size={14} />
              </button>
            )}
            <button
              onClick={onCreate}
              className="p-1.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-all"
              title="新建需求"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* 搜索 */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="搜索需求..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 text-xs bg-background-tertiary border border-border-subtle rounded-md text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* 筛选按钮 */}
        <button
          onClick={() => setShowFilter(!showFilter)}
          className="mt-2 flex items-center gap-1 text-[10px] text-text-secondary hover:text-text-primary transition-all"
        >
          <Filter size={10} />
          <span>筛选</span>
        </button>
      </div>

      {/* 筛选面板 */}
      {showFilter && (
        <div className="p-3 border-b border-border-subtle space-y-2">
          <div className="flex flex-wrap gap-1">
            <FilterChip
              label="全部"
              active={!filter.status}
              onClick={() => onFilterChange({ status: undefined })}
            />
            {(['draft', 'analyzing', 'designed', 'developing', 'testing', 'tested', 'fixing', 'accepted', 'rejected', 'cancelled'] as RequirementStatus[]).map((s) => (
              <FilterChip
                key={s}
                label={RequirementStatusLabels[s]}
                active={filter.status === s}
                onClick={() => onFilterChange({ status: filter.status === s ? undefined : s })}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <FilterChip
              label="全部优先级"
              active={!filter.priority}
              onClick={() => onFilterChange({ priority: undefined })}
            />
            {(['low', 'normal', 'high', 'urgent'] as RequirementPriority[]).map((p) => (
              <FilterChip
                key={p}
                label={RequirementPriorityLabels[p]}
                active={filter.priority === p}
                onClick={() => onFilterChange({ priority: filter.priority === p ? undefined : p })}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <FilterChip
              label="全部类型"
              active={!filter.type}
              onClick={() => onFilterChange({ type: undefined })}
            />
            {(['feature', 'bugfix', 'refactor', 'docs', 'infra', 'research', 'other'] as RequirementType[]).map((t) => (
              <FilterChip
                key={t}
                label={RequirementTypeLabels[t]}
                active={filter.type === t}
                onClick={() => onFilterChange({ type: filter.type === t ? undefined : t })}
              />
            ))}
          </div>
        </div>
      )}

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-text-muted">
            加载中...
          </div>
        ) : filteredRequirements.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-text-muted">
            {requirements.length === 0 ? '暂无需求，点击 + 创建' : '没有匹配的需求'}
          </div>
        ) : (
          <>
            {/* 待审核分组 */}
            {(() => {
              const pending = filteredRequirements.filter((r) => !r.approved)
              if (pending.length === 0) return null
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-medium text-amber-500">
                      ◉ 待审核 ({pending.length})
                    </span>
                    {onBatchApprove && pending.length > 1 && (
                      <button
                        onClick={() => onBatchApprove(pending.map((r) => r.id))}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-primary bg-primary/10 rounded hover:bg-primary/20 transition-all"
                      >
                        <CheckCircle2 size={10} />
                        <span>全部确认</span>
                      </button>
                    )}
                  </div>
                  {pending.map((req) => (
                    <RequirementCard
                      key={req.id}
                      requirement={req}
                      isSelected={req.id === selectedId}
                      onClick={onSelect}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              )
            })()}

            {/* 已确认分组 */}
            {(() => {
              const approved = filteredRequirements.filter((r) => r.approved)
              if (approved.length === 0) return null
              return (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-medium text-text-muted px-1">
                    ● 已确认
                  </span>
                  {approved.map((req) => (
                    <RequirementCard
                      key={req.id}
                      requirement={req}
                      isSelected={req.id === selectedId}
                      onClick={onSelect}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              )
            })()}
          </>
        )}
      </div>

      {/* 统计栏 */}
      {stats && (
        <div className="p-2 border-t border-border-subtle text-[10px] text-text-muted flex items-center justify-between">
          <span>总计: {stats.total}</span>
          <span>完成率: {stats.completionRate.toFixed(0)}%</span>
        </div>
      )}
    </div>
  )
}

/** 筛选小标签 */
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-1.5 py-0.5 text-[10px] rounded border transition-all ${
        active
          ? 'bg-primary/15 text-primary border-primary/30'
          : 'bg-background-tertiary text-text-secondary border-border-subtle hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  )
}
