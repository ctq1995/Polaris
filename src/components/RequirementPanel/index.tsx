/**
 * RequirementPanel - 需求库管理面板（主入口）
 *
 * 三栏布局：左侧需求列表 → 右侧需求详情（标签页）
 */

import { useState, useEffect, useCallback } from 'react'
import { useRequirementStore } from '@/stores/requirementStore'
import { useEventChatStore } from '@/stores'
import type { Requirement, RequirementStatus, CreateRequirementParams, UpdateRequirementParams } from '@/types/requirement'
import { RequirementList } from './RequirementList'
import { RequirementForm } from './RequirementForm'
import { PhaseBadge } from './PhaseBadge'
import { AIActions } from './AIActions'
import { OverviewTab } from './tabs/OverviewTab'
import { AnalysisTab } from './tabs/AnalysisTab'
import { DesignTab } from './tabs/DesignTab'
import { ExecutionTab } from './tabs/ExecutionTab'
import { TimelineTab } from './tabs/TimelineTab'
import { PrototypeTab } from './tabs/PrototypeTab'
import clsx from 'clsx'

type TabKey = 'overview' | 'analysis' | 'design' | 'execution' | 'prototype' | 'timeline'

interface RequirementPanelProps {
  className?: string
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'analysis', label: '分析' },
  { key: 'design', label: '方案' },
  { key: 'execution', label: '执行' },
  { key: 'prototype', label: '原型' },
  { key: 'timeline', label: '时间线' },
]

export function RequirementPanel({ className }: RequirementPanelProps) {
  const store = useRequirementStore()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [showForm, setShowForm] = useState(false)
  const [editingReq, setEditingReq] = useState<Requirement | null>(null)

  const selectedRequirement = store.requirements.find((r) => r.id === store.selectedId)

  // 加载数据
  useEffect(() => {
    store.loadRequirements()
  }, [])

  // AI 会话结束后自动刷新需求文件（检测 AI 对 requirements.json 的修改）
  useEffect(() => {
    const handleSessionEnd = () => {
      store.reloadRequirements()
    }
    window.addEventListener('ai-session-end', handleSessionEnd)
    return () => window.removeEventListener('ai-session-end', handleSessionEnd)
  }, [store])

  // 选中需求时自动切换到概览
  const handleSelect = useCallback((req: Requirement) => {
    store.setSelectedId(req.id)
    setActiveTab('overview')
  }, [store])

  // 状态转换
  const handleTransition = useCallback(async (targetStatus: RequirementStatus, reason?: string) => {
    if (!store.selectedId) return
    await store.transitionPhase({
      requirementId: store.selectedId,
      targetStatus,
      reason,
      actor: 'user',
    })
  }, [store])

  // 创建需求
  const handleCreate = useCallback(async (params: CreateRequirementParams) => {
    await store.createRequirement(params)
  }, [store])

  // 编辑需求
  const handleUpdate = useCallback(async (params: UpdateRequirementParams) => {
    if (!editingReq) return
    await store.updateRequirement(editingReq.id, params)
    setEditingReq(null)
  }, [store, editingReq])

  // AI 探索补充需求
  const handleAIExplore = useCallback(() => {
    const prompt = `[需求探索任务] 请探索当前代码库，识别缺失的功能、潜在的改进点和未覆盖的边界情况。使用 req_list 查看已有需求避免重复。发现新需求后使用 req_create 工具创建到需求库中。`
    try {
      useEventChatStore.getState().sendMessage(prompt)
    } catch (e) {
      console.error('[RequirementPanel] AI 探索失败:', e)
    }
  }, [])

  // 关闭表单
  const handleCloseForm = useCallback(() => {
    setShowForm(false)
    setEditingReq(null)
  }, [])

  return (
    <div className={clsx('flex h-full', className)}>
      {/* 左栏：需求列表 */}
      <div className="w-[280px] flex-shrink-0 border-r border-border-subtle">
        <RequirementList
          requirements={store.requirements}
          selectedId={store.selectedId}
          stats={store.stats}
          filter={store.filter}
          onSelect={handleSelect}
          onEdit={(req) => setEditingReq(req)}
          onDelete={(req) => store.deleteRequirement(req.id)}
          onCreate={() => setShowForm(true)}
          onFilterChange={store.setFilter}
          loading={store.loading}
          onAIExplore={handleAIExplore}
          onBatchApprove={(ids) => store.batchApproveRequirements(ids)}
        />
      </div>

      {/* 右栏：需求详情 */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedRequirement ? (
          <>
            {/* 标签栏 */}
            <div className="flex items-center border-b border-border-subtle px-2">
              <div className="flex items-center gap-2 pr-3 border-r border-border-subtle py-2 flex-shrink-0">
                <span className="text-sm font-medium text-text-primary truncate max-w-[200px]">
                  {selectedRequirement.title}
                </span>
                <PhaseBadge status={selectedRequirement.status} />
              </div>
              <AIActions requirement={selectedRequirement} className="flex-shrink-0 px-2" />
              <div className="flex items-center gap-0.5 px-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={clsx(
                      'px-2.5 py-2 text-xs transition-all border-b-2',
                      activeTab === tab.key
                        ? 'text-primary border-primary'
                        : 'text-text-secondary border-transparent hover:text-text-primary'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 标签内容 */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'overview' && (
                <OverviewTab
                  requirement={selectedRequirement}
                  onTransition={handleTransition}
                  onAddSub={(title) => store.addSubRequirement(selectedRequirement.id, title)}
                  onToggleSub={(subId) => store.toggleSubRequirement(selectedRequirement.id, subId)}
                  onDeleteSub={(subId) => store.deleteSubRequirement(selectedRequirement.id, subId)}
                />
              )}
              {activeTab === 'analysis' && (
                <AnalysisTab requirement={selectedRequirement} />
              )}
              {activeTab === 'design' && (
                <DesignTab
                  requirement={selectedRequirement}
                  onOpenPrototype={() => setActiveTab('prototype')}
                />
              )}
              {activeTab === 'execution' && (
                <ExecutionTab
                  executions={selectedRequirement.executions}
                  activeExecutionId={selectedRequirement.activeExecutionId}
                />
              )}
              {activeTab === 'prototype' && (
                <PrototypeTab
                  prototypes={selectedRequirement.design?.prototypes || []}
                  onSetCurrent={(versionId) => store.setCurrentPrototype(selectedRequirement.id, versionId)}
                />
              )}
              {activeTab === 'timeline' && (
                <TimelineTab phaseHistory={selectedRequirement.phaseHistory} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-3xl mb-2 opacity-20">📋</div>
              <span className="text-sm">选择一个需求查看详情</span>
            </div>
          </div>
        )}
      </div>

      {/* 新建/编辑表单 */}
      {showForm && (
        <RequirementForm
          onSubmit={handleCreate}
          onClose={handleCloseForm}
        />
      )}
      {editingReq && (
        <RequirementForm
          requirement={editingReq}
          onSubmit={handleCreate}
          onUpdate={handleUpdate}
          onClose={handleCloseForm}
        />
      )}
    </div>
  )
}

export default RequirementPanel
