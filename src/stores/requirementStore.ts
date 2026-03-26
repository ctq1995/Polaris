/**
 * 需求库状态管理
 */

import { create } from 'zustand';
import * as tauri from '../services/tauri';
import { useWorkspaceStore } from './workspaceStore';
import type {
  Requirement,
  RequirementStats,
  RequirementFilter,
  CreateRequirementParams,
  UpdateRequirementParams,
  SaveAnalysisParams,
  SaveDesignParams,
  SavePrototypeParams,
  CreateExecutionParams,
  FinishExecutionParams,
  TransitionPhaseParams,
  PrototypeVersion,
  RequirementExecution,
  AcceptanceCriteria,
  SubRequirement,
} from '../types/requirement';

interface RequirementState {
  /** 需求列表 */
  requirements: Requirement[];
  /** 当前选中的需求 ID */
  selectedId: string | null;
  /** 筛选条件 */
  filter: RequirementFilter;
  /** 统计信息 */
  stats: RequirementStats | null;
  /** 加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;

  // === CRUD ===
  /** 加载需求列表 */
  loadRequirements: () => Promise<void>;
  /** 创建需求 */
  createRequirement: (params: CreateRequirementParams) => Promise<Requirement>;
  /** 更新需求 */
  updateRequirement: (id: string, params: UpdateRequirementParams) => Promise<void>;
  /** 删除需求 */
  deleteRequirement: (id: string) => Promise<void>;

  // === 状态流转 ===
  /** 执行阶段转换 */
  transitionPhase: (params: TransitionPhaseParams) => Promise<Requirement>;

  // === 分析与设计 ===
  /** 保存分析结果 */
  saveAnalysis: (params: SaveAnalysisParams) => Promise<Requirement>;
  /** 保存设计方案 */
  saveDesign: (params: SaveDesignParams) => Promise<Requirement>;
  /** 保存原型 */
  savePrototype: (params: SavePrototypeParams) => Promise<PrototypeVersion>;
  /** 设置当前原型版本 */
  setCurrentPrototype: (requirementId: string, versionId: string) => Promise<void>;
  /** 更新验收标准 */
  updateCriteria: (requirementId: string, criteria: AcceptanceCriteria[]) => Promise<void>;

  // === 执行记录 ===
  /** 创建执行记录 */
  createExecution: (params: CreateExecutionParams) => Promise<RequirementExecution>;
  /** 完成执行记录 */
  finishExecution: (params: FinishExecutionParams) => Promise<void>;

  // === 子需求 ===
  /** 添加子需求 */
  addSubRequirement: (requirementId: string, title: string) => Promise<SubRequirement>;
  /** 切换子需求状态 */
  toggleSubRequirement: (requirementId: string, subId: string) => Promise<void>;
  /** 删除子需求 */
  deleteSubRequirement: (requirementId: string, subId: string) => Promise<void>;

  // === 统计 ===
  /** 刷新统计 */
  refreshStats: () => Promise<void>;

  // === 审核 ===
  /** 确认需求（审核门控） */
  approveRequirement: (id: string) => Promise<Requirement>;
  /** 批量确认需求 */
  batchApproveRequirements: (ids: string[]) => Promise<number>;

  // === 文件同步 ===
  /** 重新从磁盘加载（检测 AI 修改） */
  reloadRequirements: () => Promise<void>;

  // === UI ===
  /** 设置选中的需求 */
  setSelectedId: (id: string | null) => void;
  /** 设置筛选条件 */
  setFilter: (filter: Partial<RequirementFilter>) => void;
}

export const useRequirementStore = create<RequirementState>((set, _get) => ({
  requirements: [],
  selectedId: null,
  filter: {},
  stats: null,
  loading: false,
  error: null,

  // === CRUD ===

  loadRequirements: async () => {
    set({ loading: true, error: null });
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      const requirements = await tauri.requirementGetAll(wp);
      const stats = await tauri.requirementGetStats(wp);
      set({ requirements, stats, loading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : '加载需求失败',
        loading: false,
      });
    }
  },

  createRequirement: async (params) => {
    set({ loading: true, error: null });
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      const requirement = await tauri.requirementCreate(params, wp);
      const requirements = await tauri.requirementGetAll(wp);
      const stats = await tauri.requirementGetStats(wp);
      set({ requirements, stats, selectedId: requirement.id, loading: false });
      return requirement;
    } catch (e) {
      const error = e instanceof Error ? e.message : '创建需求失败';
      set({ error, loading: false });
      throw new Error(error);
    }
  },

  updateRequirement: async (id, params) => {
    set({ loading: true, error: null });
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      await tauri.requirementUpdate(id, params, wp);
      const requirements = await tauri.requirementGetAll(wp);
      set({ requirements, loading: false });
    } catch (e) {
      const error = e instanceof Error ? e.message : '更新需求失败';
      set({ error, loading: false });
      throw new Error(error);
    }
  },

  deleteRequirement: async (id) => {
    set({ loading: true, error: null });
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      await tauri.requirementDelete(id, wp);
      const requirements = await tauri.requirementGetAll(wp);
      const stats = await tauri.requirementGetStats(wp);
      set({ requirements, stats, loading: false });
    } catch (e) {
      const error = e instanceof Error ? e.message : '删除需求失败';
      set({ error, loading: false });
      throw new Error(error);
    }
  },

  // === 状态流转 ===

  transitionPhase: async (params) => {
    set({ loading: true, error: null });
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      const requirement = await tauri.requirementTransitionPhase(params, wp);
      const requirements = await tauri.requirementGetAll(wp);
      const stats = await tauri.requirementGetStats(wp);
      set({ requirements, stats, loading: false });
      return requirement;
    } catch (e) {
      const error = e instanceof Error ? e.message : '状态转换失败';
      set({ error, loading: false });
      throw new Error(error);
    }
  },

  // === 分析与设计 ===

  saveAnalysis: async (params) => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      const requirement = await tauri.requirementSaveAnalysis(params, wp);
      const requirements = await tauri.requirementGetAll(wp);
      set({ requirements });
      return requirement;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '保存分析失败');
    }
  },

  saveDesign: async (params) => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      const requirement = await tauri.requirementSaveDesign(params, wp);
      const requirements = await tauri.requirementGetAll(wp);
      set({ requirements });
      return requirement;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '保存设计失败');
    }
  },

  savePrototype: async (params) => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      const prototype = await tauri.requirementSavePrototype(params, wp);
      const requirements = await tauri.requirementGetAll(wp);
      set({ requirements });
      return prototype;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '保存原型失败');
    }
  },

  setCurrentPrototype: async (requirementId, versionId) => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      await tauri.requirementSetCurrentPrototype(requirementId, versionId, wp);
      const requirements = await tauri.requirementGetAll(wp);
      set({ requirements });
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '设置原型版本失败');
    }
  },

  updateCriteria: async (requirementId, criteria) => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      await tauri.requirementUpdateCriteria(requirementId, criteria, wp);
      const requirements = await tauri.requirementGetAll(wp);
      set({ requirements });
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '更新验收标准失败');
    }
  },

  // === 执行记录 ===

  createExecution: async (params) => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      const execution = await tauri.requirementCreateExecution(params, wp);
      const requirements = await tauri.requirementGetAll(wp);
      set({ requirements });
      return execution;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '创建执行记录失败');
    }
  },

  finishExecution: async (params) => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      await tauri.requirementFinishExecution(params, wp);
      const requirements = await tauri.requirementGetAll(wp);
      const stats = await tauri.requirementGetStats(wp);
      set({ requirements, stats });
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '完成执行记录失败');
    }
  },

  // === 子需求 ===

  addSubRequirement: async (requirementId, title) => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      const sub = await tauri.requirementAddSub(requirementId, title, wp);
      const requirements = await tauri.requirementGetAll(wp);
      set({ requirements });
      return sub;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '添加子需求失败');
    }
  },

  toggleSubRequirement: async (requirementId, subId) => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      await tauri.requirementToggleSub(requirementId, subId, wp);
      const requirements = await tauri.requirementGetAll(wp);
      set({ requirements });
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '切换子需求失败');
    }
  },

  deleteSubRequirement: async (requirementId, subId) => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      await tauri.requirementDeleteSub(requirementId, subId, wp);
      const requirements = await tauri.requirementGetAll(wp);
      set({ requirements });
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '删除子需求失败');
    }
  },

  // === 统计 ===

  refreshStats: async () => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      const stats = await tauri.requirementGetStats(wp);
      set({ stats });
    } catch (e) {
      console.error('刷新统计失败:', e);
    }
  },

  // === 审核 ===

  approveRequirement: async (id) => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      const requirement = await tauri.requirementApprove(id, wp);
      const requirements = await tauri.requirementGetAll(wp);
      const stats = await tauri.requirementGetStats(wp);
      set({ requirements, stats });
      return requirement;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '确认需求失败');
    }
  },

  batchApproveRequirements: async (ids) => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      const count = await tauri.requirementBatchApprove(ids, wp);
      const requirements = await tauri.requirementGetAll(wp);
      const stats = await tauri.requirementGetStats(wp);
      set({ requirements, stats });
      return count;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '批量确认失败');
    }
  },

  // === 文件同步 ===

  reloadRequirements: async () => {
    try {
      const wp = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
      const requirements = await tauri.requirementReload(wp);
      const stats = await tauri.requirementGetStats(wp);
      set({ requirements, stats });
    } catch (e) {
      console.error('重新加载需求失败:', e);
    }
  },

  // === UI ===

  setSelectedId: (id) => {
    set({ selectedId: id });
  },

  setFilter: (filter) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }));
  },
}));
