/**
 * OpenAI Providers 配置组件
 *
 * 用于管理多个 OpenAI 兼容的 API Provider
 *
 * @author Polaris Team
 * @since 2025-03-11
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Config, OpenAIProvider, EngineId } from '../../types'
import { clsx } from 'clsx'

interface OpenAIProvidersTabProps {
  config: Config
  onConfigChange: (config: Config) => void
  loading: boolean
}

export function OpenAIProvidersTab({ config, onConfigChange, loading }: OpenAIProvidersTabProps) {
  const { t } = useTranslation('settings')

  const providers = (config.openaiProviders || []).map(p => ({
    ...p,
    // 兼容旧数据：如果没有 _uid，使用 id 作为 fallback
    _uid: p._uid || p.id,
  }))
  const activeProviderId = config.activeProviderId

  // 添加新 Provider
  const addProvider = () => {
    const newProvider: OpenAIProvider = {
      _uid: `provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      id: `provider-${Date.now()}`,
      name: 'New Provider',
      apiKey: '',
      apiBase: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 8192,
      enabled: true,
      supportsTools: true,
    }
    onConfigChange({
      ...config,
      openaiProviders: [...providers, newProvider]
    })
  }

  // 删除 Provider
  const removeProvider = (id: string) => {
    const updatedProviders = providers.filter(p => p.id !== id)

    onConfigChange({
      ...config,
      openaiProviders: updatedProviders,
      activeProviderId: activeProviderId === id ? undefined : activeProviderId
    })
  }

  // 更新 Provider
  const updateProvider = (id: string, updates: Partial<OpenAIProvider>) => {
    onConfigChange({
      ...config,
      openaiProviders: providers.map(p => p.id === id ? { ...p, ...updates } : p)
    })
  }

  // 设为当前活跃 Provider
  const setActiveProvider = (id: string) => {
    onConfigChange({
      ...config,
      activeProviderId: id,
      defaultEngine: id as EngineId
    })
  }

  return (
    <div className="space-y-4">
      {/* 说明 */}
      <p className="text-sm text-text-secondary">
        {t('openaiProviders.description')}
      </p>

      {/* Provider 卡片网格 */}
      <div className="grid grid-cols-5 gap-3">
        {providers.map(provider => (
          <CompactProviderCard
            key={provider._uid}
            provider={provider}
            isActive={provider.id === activeProviderId}
            disabled={loading}
            onUpdate={(updates) => updateProvider(provider.id, updates)}
            onRemove={() => removeProvider(provider.id)}
            onSelectActive={() => setActiveProvider(provider.id)}
          />
        ))}

        {/* 添加按钮 - 小型卡片样式 */}
        <button
          onClick={addProvider}
          disabled={loading}
          className="h-20 rounded-lg border-2 border-dashed border-border-subtle text-text-tertiary hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/**
 * 紧凑型 Provider 卡片组件（用于网格显示）
 */
interface CompactProviderCardProps {
  provider: OpenAIProvider
  isActive: boolean
  disabled: boolean
  onUpdate: (updates: Partial<OpenAIProvider>) => void
  onRemove: () => void
  onSelectActive: () => void
}

function CompactProviderCard({
  provider,
  isActive,
  disabled,
  onUpdate,
  onRemove,
  onSelectActive,
}: CompactProviderCardProps) {
  const { t } = useTranslation('settings')
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div
      className={clsx(
        "h-20 rounded-lg border p-3 flex flex-col transition-all cursor-pointer group relative",
        isActive
          ? "border-primary bg-primary/10 shadow-sm"
          : provider.enabled
            ? "border-border-subtle bg-surface hover:border-primary/50 hover:shadow-sm"
            : "border-border-subtle bg-surface/50 opacity-60"
      )}
      onClick={() => !isActive && provider.enabled && onSelectActive()}
    >
      {/* 标题行 */}
      <div className="flex items-center justify-between mb-1">
        <span className={clsx(
          "text-sm font-medium truncate flex-1",
          isActive ? "text-primary" : "text-text"
        )}>
          {provider.name || 'Unnamed'}
        </span>

        {/* 启用开关 */}
        <input
          type="checkbox"
          checked={provider.enabled}
          onChange={(e) => {
            e.stopPropagation()
            onUpdate({ enabled: e.target.checked })
          }}
          disabled={disabled}
          className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* 模型名 */}
      <div className="text-xs text-text-tertiary truncate">
        {provider.model}
      </div>

      {/* 底部状态 */}
      <div className="flex items-center justify-between mt-auto">
        {/* 活跃标记 */}
        {isActive ? (
          <span className="text-xs text-primary font-medium">
            {t('openaiProviders.current')}
          </span>
        ) : (
          <span className="text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
            {provider.enabled ? t('openaiProviders.setActive') : t('openaiProviders.enable')}
          </span>
        )}

        {/* 更多操作 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="p-1 rounded text-text-muted hover:text-text hover:bg-background-hover opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      {/* 下拉菜单 */}
      {showMenu && (
        <div
          className="absolute right-2 bottom-12 bg-surface border border-border-subtle rounded-lg shadow-lg py-1 z-10 min-w-[120px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onUpdate({ name: provider.name })
              setShowMenu(false)
            }}
            className="w-full px-3 py-1.5 text-xs text-left hover:bg-background-hover"
          >
            {t('openaiProviders.edit')}
          </button>
          <button
            onClick={() => {
              onRemove()
              setShowMenu(false)
            }}
            disabled={disabled}
            className="w-full px-3 py-1.5 text-xs text-left text-danger hover:bg-danger/10"
          >
            {t('openaiProviders.remove')}
          </button>
        </div>
      )}
    </div>
  )
}