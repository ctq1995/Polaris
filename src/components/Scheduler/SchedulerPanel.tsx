/**
 * 定时任务管理面板
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useSchedulerStore, useToastStore } from '../../stores';
import type { ScheduledTask, CreateTaskParams, TaskDueEvent, TriggerType } from '../../types/scheduler';
import { SchedulerControl } from './SchedulerControl';
import { TaskCard } from './TaskCard';
import { TaskEditor } from './TaskEditor';
import { ExecutionLogDrawer } from './ExecutionLogDrawer';
import { TemplateManager } from './TemplateManager';
import { ProtocolTemplateManager } from './ProtocolTemplateManager';
import { ProtocolDocumentViewer } from './ProtocolDocumentViewer';
import { ConfirmDialog } from '../Common/ConfirmDialog';

/** 筛选条件 */
interface TaskFilter {
  search: string;
  status: 'all' | 'enabled' | 'disabled';
  engineId: string;
  triggerType: 'all' | TriggerType;
}

/** 排序条件 */
interface TaskSort {
  field: 'name' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt';
  order: 'asc' | 'desc';
}

const DEFAULT_FILTER: TaskFilter = {
  search: '',
  status: 'all',
  engineId: 'all',
  triggerType: 'all',
};

const DEFAULT_SORT: TaskSort = {
  field: 'createdAt',
  order: 'desc',
};

const FILTER_STORAGE_KEY = 'scheduler-filter';
const SORT_STORAGE_KEY = 'scheduler-sort';

/** 从 localStorage 加载筛选条件 */
function loadFilterFromStorage(): TaskFilter {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_FILTER, ...parsed };
    }
  } catch (e) {
    console.warn('加载筛选条件失败:', e);
  }
  return DEFAULT_FILTER;
}

/** 保存筛选条件到 localStorage */
function saveFilterToStorage(filter: TaskFilter): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filter));
  } catch (e) {
    console.warn('保存筛选条件失败:', e);
  }
}

/** 从 localStorage 加载排序条件 */
function loadSortFromStorage(): TaskSort {
  try {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SORT, ...parsed };
    }
  } catch (e) {
    console.warn('加载排序条件失败:', e);
  }
  return DEFAULT_SORT;
}

/** 保存排序条件到 localStorage */
function saveSortToStorage(sort: TaskSort): void {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort));
  } catch (e) {
    console.warn('保存排序条件失败:', e);
  }
}

/** 筛选任务 */
function filterTasks(tasks: ScheduledTask[], filter: TaskFilter): ScheduledTask[] {
  return tasks.filter((task) => {
    if (filter.search && !task.name.toLowerCase().includes(filter.search.toLowerCase())) {
      return false;
    }
    if (filter.status === 'enabled' && !task.enabled) return false;
    if (filter.status === 'disabled' && task.enabled) return false;
    if (filter.engineId !== 'all' && task.engineId !== filter.engineId) return false;
    if (filter.triggerType !== 'all' && task.triggerType !== filter.triggerType) return false;
    return true;
  });
}

/** 排序任务 */
function sortTasks(tasks: ScheduledTask[], sort: TaskSort): ScheduledTask[] {
  return [...tasks].sort((a, b) => {
    let aValue: string | number | undefined;
    let bValue: string | number | undefined;

    switch (sort.field) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'createdAt':
        aValue = a.createdAt;
        bValue = b.createdAt;
        break;
      case 'updatedAt':
        aValue = a.updatedAt;
        bValue = b.updatedAt;
        break;
      case 'lastRunAt':
        aValue = a.lastRunAt || 0;
        bValue = b.lastRunAt || 0;
        break;
      case 'nextRunAt':
        aValue = a.nextRunAt || 0;
        bValue = b.nextRunAt || 0;
        break;
    }

    if (aValue === bValue) return 0;
    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;

    const comparison = aValue < bValue ? -1 : 1;
    return sort.order === 'asc' ? comparison : -comparison;
  });
}

export function SchedulerPanel() {
  const { t } = useTranslation('scheduler');
  const toast = useToastStore();

  const {
    tasks,
    loading,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    toggleTask,
    runTask,
    isTaskRunning,
    isTaskSubscribed,
    subscribeToEvents,
    loadSchedulerStatus,
    handleTaskDue,
    buildPrompt,
  } = useSchedulerStore();

  // 编辑器状态
  const [showEditor, setShowEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | undefined>();
  const [copyingTask, setCopyingTask] = useState<ScheduledTask | undefined>();

  // 模板管理状态
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  // 协议模板管理状态
  const [showProtocolTemplateManager, setShowProtocolTemplateManager] = useState(false);

  // 协议文档查看状态
  const [viewingProtocolTask, setViewingProtocolTask] = useState<ScheduledTask | null>(null);

  // 筛选状态（从 localStorage 恢复）
  const [filter, setFilter] = useState<TaskFilter>(loadFilterFromStorage);

  // 排序状态（从 localStorage 恢复）
  const [sort, setSort] = useState<TaskSort>(loadSortFromStorage);

  // 确认对话框
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // 加载任务和调度器状态
  useEffect(() => {
    loadTasks();
    loadSchedulerStatus();
  }, [loadTasks, loadSchedulerStatus]);

  // 定时刷新调度器状态
  useEffect(() => {
    const interval = setInterval(loadSchedulerStatus, 5000);
    return () => clearInterval(interval);
  }, [loadSchedulerStatus]);

  // 筛选条件变化时保存到 localStorage
  useEffect(() => {
    saveFilterToStorage(filter);
  }, [filter]);

  // 排序条件变化时保存到 localStorage
  useEffect(() => {
    saveSortToStorage(sort);
  }, [sort]);

  // 监听任务到期事件
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    const setupListener = async () => {
      unlisten = await listen<TaskDueEvent>('scheduler-task-due', async (event) => {
        if (!mounted) return;

        try {
          toast.info(t('toast.taskDue'), t('toast.executing', { name: event.payload.taskName }));
          await handleTaskDue(event.payload);
        } catch (e) {
          console.error('[Scheduler] 任务执行失败:', e);
          toast.error(t('toast.executeFailed'), e instanceof Error ? e.message : String(e));
        }
      });
    };

    setupListener();

    return () => {
      mounted = false;
      if (unlisten) unlisten();
    };
  }, [handleTaskDue, toast, t]);

  // 创建任务
  const handleCreate = async (params: CreateTaskParams) => {
    try {
      await createTask(params);
      toast.success(t('toast.createSuccess'));
      setShowEditor(false);
    } catch (e) {
      toast.error(t('toast.createFailed'), e instanceof Error ? e.message : '');
    }
  };

  // 复制任务
  const handleCopy = (task: ScheduledTask) => {
    setEditingTask(undefined);
    setCopyingTask({
      ...task,
      name: `${task.name}（${t('editor.copySuffix')}）`,
    });
    setShowEditor(true);
  };

  // 复制保存
  const handleCopySave = async (params: CreateTaskParams) => {
    try {
      await createTask(params);
      toast.success(t('toast.copySuccess'));
      setShowEditor(false);
      setCopyingTask(undefined);
    } catch (e) {
      toast.error(t('toast.copyFailed'), e instanceof Error ? e.message : '');
    }
  };

  // 更新任务
  const handleUpdate = async (params: CreateTaskParams) => {
    if (!editingTask) return;
    try {
      await updateTask({
        ...editingTask,
        ...params,
      });
      toast.success(t('toast.updateSuccess'));
      setShowEditor(false);
      setEditingTask(undefined);
    } catch (e) {
      toast.error(t('toast.updateFailed'), e instanceof Error ? e.message : '');
    }
  };

  // 删除任务
  const handleDelete = (id: string) => {
    setConfirmDialog({
      show: true,
      title: t('confirm.deleteTitle'),
      message: t('confirm.deleteMessage'),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteTask(id);
          toast.success(t('toast.deleteSuccess'));
        } catch (e) {
          toast.error(t('toast.deleteFailed'), e instanceof Error ? e.message : '');
        }
      },
    });
  };

  // 执行任务（不订阅日志）
  const handleRun = async (task: ScheduledTask) => {
    if (isTaskRunning(task.id)) {
      toast.warning(t('toast.pleaseWait'));
      return;
    }

    try {
      // 执行任务（不订阅）
      await runTask(task.id, { subscribe: false });

      // 如果有模板，先构建提示词
      let finalPrompt = task.prompt;
      if (task.templateId) {
        try {
          finalPrompt = await buildPrompt(task.templateId, task.name, task.prompt);
          console.log('[Scheduler] 已应用模板，最终提示词长度:', finalPrompt.length);
        } catch (e) {
          console.error('[Scheduler] 应用模板失败，使用原始提示词:', e);
        }
      }

      // 调用 AI 引擎
      const engineId = task.engineId || 'claude-code';
      const sessionId = await invoke<string>('start_chat', {
        message: finalPrompt,
        options: {
          workDir: task.workDir,
          contextId: `scheduler-${task.id}`,
          engineId,
          enableMcpTools: engineId === 'claude-code',
        },
      });

      console.log('[Scheduler] 任务执行会话 ID:', sessionId);
      toast.success(t('toast.runTriggered'));
    } catch (e) {
      console.error('[Scheduler] 任务执行失败:', e);
      toast.error(t('toast.runFailed'), e instanceof Error ? e.message : '');
    }
  };

  // 订阅日志（仅订阅正在执行的任务）
  const handleSubscribe = async (task: ScheduledTask) => {
    if (!isTaskRunning(task.id)) {
      toast.warning(t('toast.notRunning'));
      return;
    }

    if (isTaskSubscribed(task.id)) {
      return; // 已订阅，不重复订阅
    }

    try {
      await subscribeToEvents(task.id);
      toast.success(t('toast.subscribeSuccess'));
    } catch (e) {
      console.error('[Scheduler] 订阅日志失败:', e);
      toast.error(t('toast.subscribeFailed'), e instanceof Error ? e.message : '');
    }
  };

  // 筛选后的任务
  const engineOptions = [...new Set(tasks.map((t) => t.engineId))].sort();
  const filteredTasks = sortTasks(filterTasks(tasks, filter), sort);

  // 排序字段选项
  const sortFieldOptions = [
    { value: 'createdAt', label: t('sort.createdAt', '创建时间') },
    { value: 'updatedAt', label: t('sort.updatedAt', '更新时间') },
    { value: 'name', label: t('sort.name', '任务名称') },
    { value: 'lastRunAt', label: t('sort.lastRunAt', '上次执行') },
    { value: 'nextRunAt', label: t('sort.nextRunAt', '下次执行') },
  ];

  return (
    <div className="h-full flex flex-col bg-background-base">
      {/* 头部 */}
      <div className="px-4 py-4 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-text-primary">{t('title')}</h1>
          <span className="text-xs text-text-muted bg-background-hover px-2 py-1 rounded">
            {t('taskCount', { count: tasks.length })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplateManager(true)}
            className="px-3 py-2 bg-background-hover text-text-secondary hover:bg-background-active rounded-lg transition-colors text-sm"
          >
            {t('template.title')}
          </button>
          <button
            onClick={() => setShowProtocolTemplateManager(true)}
            className="px-3 py-2 bg-background-hover text-text-secondary hover:bg-background-active rounded-lg transition-colors text-sm"
          >
            {t('protocolTemplate.title')}
          </button>
          <button
            onClick={() => {
              setEditingTask(undefined);
              setCopyingTask(undefined);
              setShowEditor(true);
            }}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors text-sm"
          >
            + {t('newTask')}
          </button>
        </div>
      </div>

      {/* 调度器控制栏 */}
      <SchedulerControl />

      {/* 筛选栏 */}
      <div className="px-4 py-3 border-b border-border-subtle bg-background-surface">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder={t('filter.search')}
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="w-48 px-3 py-1.5 text-sm bg-background-base border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value as TaskFilter['status'] })}
            className="px-2 py-1.5 text-sm bg-background-base border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">{t('filter.allStatus')}</option>
            <option value="enabled">{t('filter.enabled')}</option>
            <option value="disabled">{t('filter.disabled')}</option>
          </select>
          <select
            value={filter.triggerType}
            onChange={(e) => setFilter({ ...filter, triggerType: e.target.value as TaskFilter['triggerType'] })}
            className="px-2 py-1.5 text-sm bg-background-base border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">{t('filter.allTriggers')}</option>
            <option value="interval">{t('triggerTypes.interval')}</option>
            <option value="cron">{t('triggerTypes.cron')}</option>
            <option value="once">{t('triggerTypes.once')}</option>
          </select>
          <select
            value={filter.engineId}
            onChange={(e) => setFilter({ ...filter, engineId: e.target.value })}
            className="px-2 py-1.5 text-sm bg-background-base border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">{t('filter.allEngines')}</option>
            {engineOptions.map((engine) => (
              <option key={engine} value={engine}>
                {engine}
              </option>
            ))}
          </select>
          <button
            onClick={() => setFilter(DEFAULT_FILTER)}
            className="px-3 py-1.5 text-sm bg-background-hover text-text-secondary hover:bg-background-active rounded-lg transition-colors"
          >
            {t('filter.clear')}
          </button>
          {filteredTasks.length !== tasks.length && (
            <span className="text-xs text-text-muted">
              {filteredTasks.length}/{tasks.length}
            </span>
          )}
          {/* 排序控件 */}
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border-subtle">
            <select
              value={sort.field}
              onChange={(e) => setSort({ ...sort, field: e.target.value as TaskSort['field'] })}
              className="px-2 py-1.5 text-sm bg-background-base border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {sortFieldOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSort({ ...sort, order: sort.order === 'asc' ? 'desc' : 'asc' })}
              className="px-2 py-1.5 text-sm bg-background-base border border-border-subtle rounded-lg text-text-primary hover:bg-background-hover transition-colors"
              title={sort.order === 'asc' ? t('sort.ascending', '升序') : t('sort.descending', '降序')}
            >
              {sort.order === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-text-muted py-8">{t('loading')}</div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-text-muted py-8">{t('empty')}</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center text-text-muted py-8">{t('noMatch')}</div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isRunning={isTaskRunning(task.id)}
                isSubscribed={isTaskSubscribed(task.id)}
                onEdit={() => {
                  setCopyingTask(undefined);
                  setEditingTask(task);
                  setShowEditor(true);
                }}
                onCopy={() => handleCopy(task)}
                onDelete={() => handleDelete(task.id)}
                onToggle={() => toggleTask(task.id, !task.enabled)}
                onRun={() => handleRun(task)}
                onSubscribe={() => handleSubscribe(task)}
                onViewProtocol={
                  task.mode === 'protocol' && task.taskPath
                    ? () => setViewingProtocolTask(task)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* 执行日志抽屉 */}
      <ExecutionLogDrawer />

      {/* 编辑弹窗 */}
      {showEditor && (
        <TaskEditor
          task={editingTask || copyingTask}
          onSave={editingTask ? handleUpdate : copyingTask ? handleCopySave : handleCreate}
          title={
            editingTask
              ? t('editor.editTask')
              : copyingTask
                ? t('editor.copyTask')
                : t('editor.newTask')
          }
          onClose={() => {
            setShowEditor(false);
            setEditingTask(undefined);
            setCopyingTask(undefined);
          }}
        />
      )}

      {/* 确认对话框 */}
      {confirmDialog?.show && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          type="danger"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* 模板管理弹窗 */}
      {showTemplateManager && <TemplateManager onClose={() => setShowTemplateManager(false)} />}

      {/* 协议模板管理弹窗 */}
      {showProtocolTemplateManager && (
        <ProtocolTemplateManager onClose={() => setShowProtocolTemplateManager(false)} />
      )}

      {/* 协议文档查看弹窗 */}
      {viewingProtocolTask && (
        <ProtocolDocumentViewer
          task={viewingProtocolTask}
          onClose={() => setViewingProtocolTask(null)}
        />
      )}
    </div>
  );
}

export default SchedulerPanel;
