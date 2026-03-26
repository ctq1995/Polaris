/**
 * AnalysisTab - 需求分析标签页
 */

import { Brain, FileCode, AlertTriangle, Clock } from 'lucide-react'
import type { Requirement } from '@/types/requirement'

interface AnalysisTabProps {
  requirement: Requirement
}

export function AnalysisTab({ requirement: req }: AnalysisTabProps) {
  const analysis = req.analysis

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-text-muted">
        <Brain size={32} className="mb-2 opacity-30" />
        <span className="text-xs">暂无分析结果</span>
        <span className="text-[10px] mt-1">可由 Agent 自动分析或手动补充</span>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {/* 摘要 */}
      {analysis.summary && (
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-1">需求摘要</h3>
          <div className="text-xs text-text-primary whitespace-pre-wrap bg-background-tertiary/50 rounded-md p-2">
            {analysis.summary}
          </div>
        </div>
      )}

      {/* 影响范围 */}
      {analysis.scope && (
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-1">影响范围</h3>
          <div className="text-xs text-text-primary whitespace-pre-wrap">{analysis.scope}</div>
        </div>
      )}

      {/* 建议子任务 */}
      {analysis.suggestedTasks && analysis.suggestedTasks.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-1">建议子任务</h3>
          <div className="space-y-1">
            {analysis.suggestedTasks.map((task, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-primary mt-0.5">{i + 1}.</span>
                <span className="text-text-primary">{task}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 建议文件 */}
      {analysis.suggestedFiles && analysis.suggestedFiles.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-1">
            <FileCode size={12} className="inline mr-1" />
            相关文件
          </h3>
          <div className="flex flex-wrap gap-1">
            {analysis.suggestedFiles.map((file) => (
              <span key={file} className="px-1.5 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 rounded font-mono">
                {file}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 复杂度与工时 */}
      <div className="flex items-center gap-4">
        {analysis.complexity && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-text-secondary">复杂度:</span>
            <ComplexityBadge complexity={analysis.complexity} />
          </div>
        )}
        {analysis.estimatedHours && (
          <div className="flex items-center gap-1">
            <Clock size={12} className="text-text-secondary" />
            <span className="text-xs text-text-primary">预估: {analysis.estimatedHours}h</span>
          </div>
        )}
      </div>

      {/* 风险点 */}
      {analysis.risks && analysis.risks.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-1">
            <AlertTriangle size={12} className="inline mr-1 text-amber-400" />
            风险点
          </h3>
          <div className="space-y-1">
            {analysis.risks.map((risk, i) => (
              <div key={i} className="text-xs text-amber-400 flex items-start gap-1">
                <span>•</span>
                <span>{risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 分析时间 */}
      <div className="text-[10px] text-text-muted pt-2 border-t border-border-subtle">
        分析于 {new Date(analysis.analyzedAt * 1000).toLocaleString('zh-CN')}
        {analysis.sessionId && <span> · 会话: {analysis.sessionId.slice(0, 8)}</span>}
      </div>
    </div>
  )
}

function ComplexityBadge({ complexity }: { complexity: string }) {
  const styles: Record<string, string> = {
    simple: 'bg-green-500/15 text-green-400',
    medium: 'bg-amber-500/15 text-amber-400',
    complex: 'bg-red-500/15 text-red-400',
  }
  const labels: Record<string, string> = {
    simple: '简单',
    medium: '中等',
    complex: '复杂',
  }
  return (
    <span className={`px-1.5 py-0.5 text-[10px] rounded ${styles[complexity] || ''}`}>
      {labels[complexity] || complexity}
    </span>
  )
}
