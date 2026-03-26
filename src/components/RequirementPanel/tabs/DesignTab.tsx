/**
 * DesignTab - 方案设计标签页
 */

import { FileCode, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import type { Requirement } from '@/types/requirement'
import clsx from 'clsx'

interface DesignTabProps {
  requirement: Requirement
  onOpenPrototype?: () => void
}

export function DesignTab({ requirement: req, onOpenPrototype }: DesignTabProps) {
  const design = req.design
  const prototypes = design?.prototypes
  const criteria = design?.acceptanceCriteria

  const passedCount = criteria?.filter((c) => c.passed).length || 0
  const totalCriteria = criteria?.length || 0

  if (!design && !prototypes?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-text-muted">
        <FileCode size={32} className="mb-2 opacity-30" />
        <span className="text-xs">暂无设计方案</span>
        <span className="text-[10px] mt-1">可在方案设计阶段补充方案和原型</span>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* 方案描述 */}
      {design?.solution && (
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-1">方案描述</h3>
          <div className="text-xs text-text-primary whitespace-pre-wrap bg-background-tertiary/50 rounded-md p-2">
            {design.solution}
          </div>
        </div>
      )}

      {/* 技术备注 */}
      {design?.technicalNotes && (
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-1">技术备注</h3>
          <div className="text-xs text-text-primary whitespace-pre-wrap bg-background-tertiary/50 rounded-md p-2">
            {design.technicalNotes}
          </div>
        </div>
      )}

      {/* 原型预览入口 */}
      {prototypes && prototypes.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-1">
            原型版本 ({prototypes.length})
          </h3>
          <div className="space-y-1">
            {prototypes.map((proto) => (
              <div
                key={proto.id}
                className={clsx(
                  'flex items-center gap-2 px-2 py-1.5 rounded border text-xs',
                  proto.isCurrent
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border-subtle bg-background-surface'
                )}
              >
                <span className="text-text-secondary">v{proto.version}</span>
                {proto.isCurrent && (
                  <span className="text-[10px] text-primary">当前</span>
                )}
                {proto.note && (
                  <span className="flex-1 text-text-muted truncate">{proto.note}</span>
                )}
                <span className="text-[10px] text-text-muted">
                  {new Date(proto.createdAt * 1000).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
          {onOpenPrototype && (
            <button
              onClick={onOpenPrototype}
              className="mt-2 flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-all"
            >
              <ExternalLink size={12} />
              打开原型预览
            </button>
          )}
        </div>
      )}

      {/* 验收标准 */}
      <div>
        <h3 className="text-xs font-medium text-text-secondary mb-1">
          验收标准 ({passedCount}/{totalCriteria})
        </h3>
        {criteria && criteria.length > 0 ? (
          <div className="space-y-1">
            {criteria.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-2 px-2 py-1.5 rounded bg-background-surface"
              >
                {c.passed ? (
                  <CheckCircle size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                ) : c.passed === false ? (
                  <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-border-subtle flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={clsx(
                    'text-xs',
                    c.passed ? 'text-text-muted line-through' : 'text-text-primary'
                  )}>
                    {c.content}
                  </p>
                  {c.note && (
                    <p className="text-[10px] text-text-muted mt-0.5">{c.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-text-muted">暂无验收标准</span>
        )}
      </div>

      {/* 设计时间 */}
      {design?.designedAt && (
        <div className="text-[10px] text-text-muted pt-2 border-t border-border-subtle">
          设计于 {new Date(design.designedAt * 1000).toLocaleString('zh-CN')}
        </div>
      )}
    </div>
  )
}
