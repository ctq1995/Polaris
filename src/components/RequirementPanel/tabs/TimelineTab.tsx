/**
 * TimelineTab - 阶段转换时间线标签页
 */

import { ArrowRight, User, Bot } from 'lucide-react'
import clsx from 'clsx'
import type { PhaseTransition } from '@/types/requirement'
import { PhaseBadge } from '../PhaseBadge'

interface TimelineTabProps {
  phaseHistory: PhaseTransition[]
}

export function TimelineTab({ phaseHistory }: TimelineTabProps) {
  if (phaseHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-text-muted">
        <span className="text-xs">暂无阶段转换记录</span>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="relative">
        {/* 时间线 */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border-subtle" />

        <div className="space-y-3">
          {[...phaseHistory].reverse().map((transition) => (
            <div key={transition.id} className="relative pl-8">
              {/* 时间线节点 */}
              <div
                className={clsx(
                  'absolute left-2 top-1.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center',
                  transition.actor === 'agent'
                    ? 'border-primary bg-primary/20'
                    : 'border-text-secondary bg-background-surface'
                )}
              >
                {transition.actor === 'agent' ? (
                  <Bot size={9} className="text-primary" />
                ) : (
                  <User size={9} className="text-text-secondary" />
                )}
              </div>

              {/* 内容 */}
              <div className="bg-background-surface border border-border-subtle rounded-md p-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <PhaseBadge status={transition.from as any} />
                  <ArrowRight size={10} className="text-text-muted" />
                  <PhaseBadge status={transition.to as any} />
                </div>

                {transition.reason && (
                  <div className="mt-1.5 text-xs text-text-primary">
                    {transition.reason}
                  </div>
                )}

                <div className="mt-1 text-[10px] text-text-muted">
                  {new Date(transition.timestamp * 1000).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
