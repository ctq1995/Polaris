/**
 * 定时任务设置 Tab（精简版）
 */

import { useEffect, useState } from 'react';
import { useSchedulerStore, useToastStore } from '../../../stores';
import { ConfirmDialog } from '../../Common/ConfirmDialog';
import { TaskEditor } from '../../Scheduler/TaskEditor';
import type { ScheduledTask, CreateTaskParams } from '../../../types/scheduler';
import { TriggerTypeLabels } from '../../../types/scheduler';

/** 格式化相对时间 */
function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return '--';
  const now = Date.now() / 1000;
  const diff = timestamp - now;

  if (diff < 0) return '已过期';
  if (diff < 60) return `${Math.floor(diff)} 秒后`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟后`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时后`;
  return `${Math.floor(diff / 86400)} 天后`;
}

/** 状态徽章 */
function StatusBadge({ status }: { status?: 'running' | 'success' | 'failed' }) {
  if (!status) return <span className="text-gray-400">未执行</span>;

  const styles = {
    running: 'bg-blue-500/20 text-blue-400',
    success: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };

  const labels = {
    running: '执行中',
    success: '成功',
    failed: '失败',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

/** 主组件 */
export function SchedulerTab() {
  const { tasks, loading, loadTasks, createTask, updateTask, deleteTask, toggleTask } = useSchedulerStore();
  const toast = useToastStore();

  const [showEditor, setShowEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | undefined>();
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  } | null>(null);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleCreate = async (params: CreateTaskParams) => {
    try {
      await createTask(params);
      toast.success('任务创建成功');
      setShowEditor(false);
    } catch (e) {
      toast.error('创建失败', e instanceof Error ? e.message : undefined);
    }
  };

  const handleUpdate = async (params: CreateTaskParams) => {
    if (!editingTask) return;
    try {
      await updateTask({
        ...editingTask,
        ...params,
      });
      toast.success('任务更新成功');
      setShowEditor(false);
      setEditingTask(undefined);
    } catch (e) {
      toast.error('更新失败', e instanceof Error ? e.message : undefined);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      show: true,
      title: '删除任务',
      message: '确定要删除这个任务吗？此操作不可撤销。',
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteTask(id);
          toast.success('任务已删除');
        } catch (e) {
          toast.error('删除失败', e instanceof Error ? e.message : undefined);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-text-primary">定时任务</h3>
          <p className="text-sm text-text-muted mt-1">创建定时执行的 AI 任务</p>
        </div>
        <button
          onClick={() => {
            setEditingTask(undefined);
            setShowEditor(true);
          }}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded transition-colors"
        >
          + 新建任务
        </button>
      </div>

      {/* 任务列表 */}
      {loading ? (
        <div className="text-center text-text-muted py-8">加载中...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center text-text-muted py-8">
          暂无定时任务，点击右上角按钮创建
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="bg-surface rounded-lg p-4 border border-border-subtle">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${task.enabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-text-primary font-medium">{task.name}</span>
                    {task.description && (
                      <span className="text-xs text-text-muted">{task.description}</span>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-text-muted space-y-1">
                    <p>触发: {TriggerTypeLabels[task.triggerType]} - {task.triggerValue}</p>
                    <p>引擎: {task.engineId}</p>
                    <div className="flex items-center gap-4">
                      <span>状态: <StatusBadge status={task.lastRunStatus} /></span>
                      {task.enabled && task.nextRunAt && (
                        <span>下次: {formatRelativeTime(task.nextRunAt)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTask(task.id, !task.enabled)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      task.enabled
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    }`}
                  >
                    {task.enabled ? '禁用' : '启用'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingTask(task);
                      setShowEditor(true);
                    }}
                    className="px-3 py-1 text-sm bg-surface text-text-secondary hover:text-text-primary rounded transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="px-3 py-1 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      {showEditor && (
        <TaskEditor
          task={editingTask}
          onSave={editingTask ? handleUpdate : handleCreate}
          onClose={() => {
            setShowEditor(false);
            setEditingTask(undefined);
          }}
          title={editingTask ? '编辑任务' : '新建任务'}
        />
      )}

      {/* 确认对话框 */}
      {confirmDialog?.show && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          type={confirmDialog.type}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
