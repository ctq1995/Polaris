/**
 * RequirementForm - 新建/编辑需求表单
 */

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type {
  Requirement,
  CreateRequirementParams,
  UpdateRequirementParams,
  RequirementType,
  RequirementPriority,
} from '@/types/requirement'
import { RequirementTypeLabels, RequirementPriorityLabels } from '@/types/requirement'

interface RequirementFormProps {
  requirement?: Requirement | null
  onSubmit: (params: CreateRequirementParams) => Promise<void>
  onUpdate?: (params: UpdateRequirementParams) => Promise<void>
  onClose: () => void
}

export function RequirementForm({
  requirement,
  onSubmit,
  onUpdate,
  onClose,
}: RequirementFormProps) {
  const isEdit = !!requirement
  const [title, setTitle] = useState(requirement?.title || '')
  const [description, setDescription] = useState(requirement?.description || '')
  const [type, setType] = useState<RequirementType>(requirement?.type || 'feature')
  const [priority, setPriority] = useState<RequirementPriority>(requirement?.priority || 'normal')
  const [tags, setTags] = useState(requirement?.tags?.join(', ') || '')
  const [group, setGroup] = useState(requirement?.group || '')
  const [dueDate, setDueDate] = useState(requirement?.dueDate || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (requirement) {
      setTitle(requirement.title)
      setDescription(requirement.description)
      setType(requirement.type)
      setPriority(requirement.priority)
      setTags(requirement.tags?.join(', ') || '')
      setGroup(requirement.group || '')
      setDueDate(requirement.dueDate || '')
    }
  }, [requirement])

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('请输入需求标题')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const tagsArr = tags.split(',').map((t) => t.trim()).filter(Boolean)
      const dueDateVal = dueDate || undefined

      if (isEdit && onUpdate) {
        await onUpdate({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          priority,
          tags: tagsArr.length > 0 ? tagsArr : undefined,
          group: group.trim() || undefined,
          dueDate: dueDateVal,
        })
      } else {
        await onSubmit({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          priority,
          tags: tagsArr.length > 0 ? tagsArr : undefined,
          group: group.trim() || undefined,
          dueDate: dueDateVal,
        })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background-elevated border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-medium text-text-primary">
            {isEdit ? '编辑需求' : '新建需求'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-background-hover text-text-secondary">
            <X size={16} />
          </button>
        </div>

        {/* 表单 */}
        <div className="p-4 space-y-3">
          {error && (
            <div className="px-3 py-2 text-xs text-red-400 bg-red-500/10 rounded-md">
              {error}
            </div>
          )}

          {/* 标题 */}
          <div>
            <label className="text-xs text-text-secondary block mb-1">标题 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="需求标题..."
              className="w-full px-3 py-2 text-sm bg-background-tertiary border border-border-subtle rounded-md text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50"
              autoFocus
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="text-xs text-text-secondary block mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="详细描述需求内容..."
              rows={4}
              className="w-full px-3 py-2 text-sm bg-background-tertiary border border-border-subtle rounded-md text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>

          {/* 类型 + 优先级 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-text-secondary block mb-1">类型</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as RequirementType)}
                className="w-full px-3 py-2 text-sm bg-background-tertiary border border-border-subtle rounded-md text-text-primary focus:outline-none focus:border-primary/50"
              >
                {Object.entries(RequirementTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-text-secondary block mb-1">优先级</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as RequirementPriority)}
                className="w-full px-3 py-2 text-sm bg-background-tertiary border border-border-subtle rounded-md text-text-primary focus:outline-none focus:border-primary/50"
              >
                {Object.entries(RequirementPriorityLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 标签 + 分组 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-text-secondary block mb-1">标签</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="用逗号分隔..."
                className="w-full px-3 py-2 text-sm bg-background-tertiary border border-border-subtle rounded-md text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-text-secondary block mb-1">分组</label>
              <input
                type="text"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder="分组名称..."
                className="w-full px-3 py-2 text-sm bg-background-tertiary border border-border-subtle rounded-md text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* 截止日期 */}
          <div>
            <label className="text-xs text-text-secondary block mb-1">截止日期</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background-tertiary border border-border-subtle rounded-md text-text-primary focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-subtle">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="px-4 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : isEdit ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
