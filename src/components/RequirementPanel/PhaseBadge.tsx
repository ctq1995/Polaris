/**
 * PhaseBadge - 需求阶段状态徽章
 */

import clsx from 'clsx'
import type { RequirementStatus } from '@/types/requirement'
import { RequirementStatusLabels } from '@/types/requirement'

interface PhaseBadgeProps {
  status: RequirementStatus
  size?: 'sm' | 'md'
  className?: string
}

const statusStyles: Record<RequirementStatus, string> = {
  draft: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  analyzing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  designed: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  developing: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  testing: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  tested: 'bg-green-500/15 text-green-400 border-green-500/30',
  fixing: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  accepted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  cancelled: 'bg-gray-500/15 text-gray-500 border-gray-500/30',
}

export function PhaseBadge({ status, size = 'sm', className }: PhaseBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium border rounded',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
        statusStyles[status],
        className
      )}
    >
      {RequirementStatusLabels[status]}
    </span>
  )
}
