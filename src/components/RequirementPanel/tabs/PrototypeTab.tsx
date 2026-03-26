/**
 * PrototypeTab - 原型预览标签页
 */

import { useState, useRef } from 'react'
import { Eye, Code, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PrototypeVersion } from '@/types/requirement'
import clsx from 'clsx'

interface PrototypeTabProps {
  prototypes: PrototypeVersion[]
  onSetCurrent: (versionId: string) => void
}

export function PrototypeTab({ prototypes, onSetCurrent }: PrototypeTabProps) {
  const [showCode, setShowCode] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(
    prototypes.findIndex((p) => p.isCurrent) || 0
  )
  const iframeRef = useRef<HTMLIFrameElement>(null)

  if (prototypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-text-muted">
        <Eye size={32} className="mb-2 opacity-30" />
        <span className="text-xs">暂无原型</span>
        <span className="text-[10px] mt-1">可在方案设计阶段添加 HTML 原型</span>
      </div>
    )
  }

  const current = prototypes[currentIdx]

  const handlePrev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1)
  }

  const handleNext = () => {
    if (currentIdx < prototypes.length - 1) setCurrentIdx(currentIdx + 1)
  }

  const handleSetCurrent = () => {
    if (current) {
      onSetCurrent(current.id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <button onClick={handlePrev} disabled={currentIdx <= 0} className="p-1 rounded hover:bg-background-hover disabled:opacity-30">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-text-primary">
            v{current.version}
            {current.isCurrent && <span className="ml-1 text-primary">(当前)</span>}
          </span>
          <button onClick={handleNext} disabled={currentIdx >= prototypes.length - 1} className="p-1 rounded hover:bg-background-hover disabled:opacity-30">
            <ChevronRight size={14} />
          </button>
          <span className="text-[10px] text-text-muted">
            {currentIdx + 1} / {prototypes.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {!current.isCurrent && (
            <button
              onClick={handleSetCurrent}
              className="flex items-center gap-1 px-2 py-1 text-[10px] bg-primary/10 text-primary rounded hover:bg-primary/20 transition-all"
            >
              设为当前版本
            </button>
          )}
          <button
            onClick={() => setShowCode(!showCode)}
            className={clsx(
              'p-1.5 rounded transition-all',
              showCode ? 'bg-primary/15 text-primary' : 'hover:bg-background-hover text-text-secondary'
            )}
            title={showCode ? '预览模式' : '代码模式'}
          >
            <Code size={12} />
          </button>
        </div>
      </div>

      {current.note && (
        <div className="px-3 py-1.5 text-[10px] text-text-secondary bg-background-tertiary/30 border-b border-border-subtle">
          {current.note}
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 relative">
        {showCode ? (
          <pre className="h-full overflow-auto p-3 text-xs font-mono text-text-primary bg-[#1a1a2e]">
            <code>{current.htmlContent}</code>
          </pre>
        ) : (
          <iframe
            ref={iframeRef}
            srcDoc={current.htmlContent}
            sandbox="allow-scripts"
            className="w-full h-full border-0"
            title={`原型 v${current.version}`}
          />
        )}
      </div>
    </div>
  )
}
