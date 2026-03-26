use crate::models::requirement::{
    AcceptanceCriteria, CreateExecutionParams, CreateRequirementParams,
    FinishExecutionParams, Requirement, RequirementStats,
    SaveAnalysisParams, SaveDesignParams, SavePrototypeParams,
    TransitionPhaseParams, UpdateRequirementParams,
};
use crate::services::requirement::RequirementStoreService;
use crate::state::AppState;
use crate::error::Result;
use std::sync::Arc;
use tokio::sync::Mutex as AsyncMutex;

#[allow(non_snake_case)]

// ============================================================================
// 工作区存储路由
// ============================================================================

/// 获取或创建工作区级 store
async fn get_store_for_workspace(
    state: &tauri::State<'_, AppState>,
    workspace_path: Option<&str>,
) -> Arc<AsyncMutex<RequirementStoreService>> {
    if let Some(wp) = workspace_path {
        if !wp.is_empty() {
            let mut caches = state.workspace_requirement_stores.lock().await;
            return caches
                .entry(wp.to_string())
                .or_insert_with(|| {
                    Arc::new(AsyncMutex::new(
                        RequirementStoreService::new_for_workspace(wp)
                            .unwrap_or_else(|_| {
                                RequirementStoreService::new()
                                    .expect("无法初始化需求存储（回退全局）")
                            })
                    ))
                })
                .clone();
        }
    }
    state.requirement_store.clone()
}

// ============================================================================
// CRUD
// ============================================================================

/// 获取所有需求
#[tauri::command]
pub async fn requirement_get_all(
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Requirement>> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let guard = store.lock().await;
    Ok(guard.get_all().to_vec())
}

/// 获取单个需求
#[tauri::command]
pub async fn requirement_get(
    id: String,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Option<Requirement>> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let guard = store.lock().await;
    Ok(guard.get(&id).cloned())
}

/// 创建需求
#[tauri::command]
pub async fn requirement_create(
    params: CreateRequirementParams,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Requirement> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.create(params)
}

/// 更新需求
#[tauri::command]
pub async fn requirement_update(
    id: String,
    params: UpdateRequirementParams,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<()> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.update(&id, params)
}

/// 删除需求
#[tauri::command]
pub async fn requirement_delete(
    id: String,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<()> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.delete(&id)
}

// ============================================================================
// 状态流转
// ============================================================================

/// 执行阶段转换
#[tauri::command]
pub async fn requirement_transition_phase(
    params: TransitionPhaseParams,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Requirement> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.transition_phase(params)
}

// ============================================================================
// 分析与设计
// ============================================================================

/// 保存分析结果
#[tauri::command]
pub async fn requirement_save_analysis(
    params: SaveAnalysisParams,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Requirement> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.save_analysis(params)
}

/// 保存设计方案
#[tauri::command]
pub async fn requirement_save_design(
    params: SaveDesignParams,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Requirement> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.save_design(params)
}

/// 保存原型
#[tauri::command]
pub async fn requirement_save_prototype(
    params: SavePrototypeParams,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<crate::models::requirement::PrototypeVersion> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.save_prototype(params)
}

/// 设置当前原型版本
#[tauri::command]
pub async fn requirement_set_current_prototype(
    requirement_id: String,
    version_id: String,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<()> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.set_current_prototype(&requirement_id, &version_id)
}

/// 更新验收标准
#[tauri::command]
pub async fn requirement_update_criteria(
    requirement_id: String,
    criteria: Vec<AcceptanceCriteria>,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<()> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.update_criteria(&requirement_id, criteria)
}

// ============================================================================
// 执行记录
// ============================================================================

/// 创建执行记录
#[tauri::command]
pub async fn requirement_create_execution(
    params: CreateExecutionParams,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<crate::models::requirement::RequirementExecution> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.create_execution(params)
}

/// 完成执行记录
#[tauri::command]
pub async fn requirement_finish_execution(
    params: FinishExecutionParams,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<()> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.finish_execution(params)
}

// ============================================================================
// 子需求
// ============================================================================

/// 添加子需求
#[tauri::command]
pub async fn requirement_add_sub(
    requirement_id: String,
    title: String,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<crate::models::requirement::SubRequirement> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.add_sub_requirement(&requirement_id, title)
}

/// 切换子需求状态
#[tauri::command]
pub async fn requirement_toggle_sub(
    requirement_id: String,
    sub_id: String,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<()> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.toggle_sub_requirement(&requirement_id, &sub_id)
}

/// 删除子需求
#[tauri::command]
pub async fn requirement_delete_sub(
    requirement_id: String,
    sub_id: String,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<()> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.delete_sub_requirement(&requirement_id, &sub_id)
}

// ============================================================================
// 统计
// ============================================================================

/// 获取需求统计
#[tauri::command]
pub async fn requirement_get_stats(
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<RequirementStats> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let guard = store.lock().await;
    Ok(guard.get_stats())
}

// ============================================================================
// 审核
// ============================================================================

/// 确认需求（审核门控）
#[tauri::command]
pub async fn requirement_approve(
    id: String,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Requirement> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.approve(&id)
}

/// 批量确认需求
#[tauri::command]
pub async fn requirement_batch_approve(
    ids: Vec<String>,
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<usize> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.batch_approve(&ids)
}

// ============================================================================
// 文件同步
// ============================================================================

/// 重新从磁盘加载需求文件（检测 AI 修改）
#[tauri::command]
pub async fn requirement_reload(
    workspace_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Requirement>> {
    let store = get_store_for_workspace(&state, workspace_path.as_deref()).await;
    let mut guard = store.lock().await;
    guard.reload()?;
    Ok(guard.get_all().to_vec())
}
