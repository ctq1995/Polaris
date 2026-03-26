use crate::error::{AppError, Result};
use crate::models::requirement::{
    AcceptanceCriteria, CreateExecutionParams, CreateRequirementParams,
    ExecutionStatus, FinishExecutionParams,
    PhaseTransition, PrototypeVersion, Requirement,
    RequirementStore, RequirementStats, RequirementStatus,
    SaveAnalysisParams, SaveDesignParams, SavePrototypeParams, SubRequirement,
    TransitionPhaseParams, UpdateRequirementParams,
};
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;
use chrono::Utc;

/// 需求存储服务
///
/// 管理需求的持久化存储，使用 JSON 文件存储
pub struct RequirementStoreService {
    store: RequirementStore,
    store_path: PathBuf,
}

impl RequirementStoreService {
    /// 创建新的需求存储服务（向后兼容：使用全局配置目录）
    pub fn new() -> Result<Self> {
        let store_dir = dirs::config_dir()
            .ok_or_else(|| AppError::ConfigError("无法获取配置目录".to_string()))?
            .join("claude-code-pro");

        std::fs::create_dir_all(&store_dir)?;

        let store_path = store_dir.join("requirements.json");
        let store = Self::load_from_file(&store_path)?;

        Ok(Self { store, store_path })
    }

    /// 按工作区路径创建需求存储服务
    /// 存储到 {workspace_path}/.polaris/requirements.json
    pub fn new_for_workspace(workspace_path: &str) -> Result<Self> {
        let store_path = std::path::Path::new(workspace_path)
            .join(".polaris")
            .join("requirements.json");

        std::fs::create_dir_all(store_path.parent().unwrap())?;
        let store = Self::load_from_file(&store_path)?;

        Ok(Self { store, store_path })
    }

    /// 重新从磁盘加载文件（用于检测 AI 对文件的修改）
    pub fn reload(&mut self) -> Result<()> {
        self.store = Self::load_from_file(&self.store_path)?;
        Ok(())
    }

    /// 获取当前存储路径
    pub fn store_path(&self) -> &std::path::Path {
        &self.store_path
    }

    /// 从文件加载
    fn load_from_file(path: &PathBuf) -> Result<RequirementStore> {
        if path.exists() {
            let content = std::fs::read_to_string(path)?;
            if let Ok(store) = serde_json::from_str::<RequirementStore>(&content) {
                return Ok(store);
            }
        }
        Ok(RequirementStore::default())
    }

    /// 保存到文件
    fn save(&self) -> Result<()> {
        let content = serde_json::to_string_pretty(&self.store)?;
        std::fs::write(&self.store_path, content)?;
        Ok(())
    }

    // ========================================================================
    // CRUD
    // ========================================================================

    /// 获取所有需求
    pub fn get_all(&self) -> &[Requirement] {
        &self.store.requirements
    }

    /// 获取单个需求
    pub fn get(&self, id: &str) -> Option<&Requirement> {
        self.store.requirements.iter().find(|r| r.id == id)
    }

    /// 创建需求
    pub fn create(&mut self, params: CreateRequirementParams) -> Result<Requirement> {
        let now = Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        let requirement = Requirement {
            id: id.clone(),
            title: params.title,
            description: params.description.unwrap_or_default(),
            r#type: params.r#type.unwrap_or_default(),
            priority: params.priority.unwrap_or_default(),
            status: RequirementStatus::Draft,
            approved: false,
            source: params.source,
            tags: params.tags,
            group: params.group,
            sub_requirements: None,
            analysis: None,
            design: None,
            executions: Vec::new(),
            phase_history: Vec::new(),
            related_files: params.related_files,
            dependencies: params.dependencies,
            workspace_path: params.workspace_path,
            workspace_id: params.workspace_id,
            created_at: now,
            updated_at: now,
            completed_at: None,
            due_date: params.due_date,
            active_execution_id: None,
        };

        self.store.requirements.push(requirement.clone());
        self.save()?;
        Ok(requirement)
    }

    /// 更新需求基本信息
    pub fn update(&mut self, id: &str, params: UpdateRequirementParams) -> Result<()> {
        if let Some(req) = self.store.requirements.iter_mut().find(|r| r.id == id) {
            let now = Utc::now().timestamp();

            if let Some(title) = params.title { req.title = title; }
            if let Some(description) = params.description { req.description = description; }
            if let Some(r#type) = params.r#type { req.r#type = r#type; }
            if let Some(priority) = params.priority { req.priority = priority; }
            if let Some(tags) = params.tags { req.tags = Some(tags); }
            if let Some(group) = params.group { req.group = Some(group); }
            if let Some(due_date) = params.due_date { req.due_date = Some(due_date); }
            if let Some(related_files) = params.related_files { req.related_files = Some(related_files); }
            if let Some(dependencies) = params.dependencies { req.dependencies = Some(dependencies); }
            if let Some(sub_requirements) = params.sub_requirements { req.sub_requirements = Some(sub_requirements); }

            req.updated_at = now;
            self.save()?;
        }
        Ok(())
    }

    /// 删除需求
    pub fn delete(&mut self, id: &str) -> Result<()> {
        let len_before = self.store.requirements.len();
        self.store.requirements.retain(|r| r.id != id);
        if self.store.requirements.len() < len_before {
            self.save()?;
        }
        Ok(())
    }

    // ========================================================================
    // 状态流转
    // ========================================================================

    /// 执行阶段转换
    pub fn transition_phase(&mut self, params: TransitionPhaseParams) -> Result<Requirement> {
        let req = self.store.requirements.iter_mut()
            .find(|r| r.id == params.requirement_id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", params.requirement_id)))?;

        let from = req.status.clone();
        let to = params.target_status.clone();

        // 验证转换合法性
        if !Self::is_valid_transition(&from, &to) {
            return Err(AppError::ValidationError(format!(
                "非法的状态转换: {:?} -> {:?}", from, to
            )));
        }

        let now = Utc::now().timestamp();

        // 记录阶段转换
        let transition = PhaseTransition {
            id: Uuid::new_v4().to_string(),
            from: format!("{:?}", from).to_lowercase(),
            to: format!("{:?}", to).to_lowercase(),
            reason: params.reason,
            actor: params.actor,
            session_id: params.session_id,
            timestamp: now,
        };
        req.phase_history.push(transition);

        // 更新状态
        let is_accepted = to == RequirementStatus::Accepted;
        req.status = to;
        req.updated_at = now;

        // 如果完成状态，设置完成时间
        if is_accepted {
            req.completed_at = Some(now);
        }

        let result = req.clone();
        self.save()?;
        Ok(result)
    }

    /// 验证状态转换是否合法
    fn is_valid_transition(from: &RequirementStatus, to: &RequirementStatus) -> bool {
        matches!(
            (from, to),
            // draft
            (RequirementStatus::Draft, RequirementStatus::Analyzing)
            | (RequirementStatus::Draft, RequirementStatus::Cancelled)
            // analyzing
            | (RequirementStatus::Analyzing, RequirementStatus::Designed)
            | (RequirementStatus::Analyzing, RequirementStatus::Draft)
            | (RequirementStatus::Analyzing, RequirementStatus::Cancelled)
            // designed
            | (RequirementStatus::Designed, RequirementStatus::Developing)
            | (RequirementStatus::Designed, RequirementStatus::Analyzing)
            | (RequirementStatus::Designed, RequirementStatus::Cancelled)
            // developing
            | (RequirementStatus::Developing, RequirementStatus::Testing)
            | (RequirementStatus::Developing, RequirementStatus::Designed)
            | (RequirementStatus::Developing, RequirementStatus::Cancelled)
            // testing
            | (RequirementStatus::Testing, RequirementStatus::Tested)
            | (RequirementStatus::Testing, RequirementStatus::Fixing)
            | (RequirementStatus::Testing, RequirementStatus::Developing)
            | (RequirementStatus::Testing, RequirementStatus::Cancelled)
            // tested
            | (RequirementStatus::Tested, RequirementStatus::Accepted)
            | (RequirementStatus::Tested, RequirementStatus::Rejected)
            | (RequirementStatus::Tested, RequirementStatus::Testing)
            | (RequirementStatus::Tested, RequirementStatus::Cancelled)
            // fixing
            | (RequirementStatus::Fixing, RequirementStatus::Testing)
            | (RequirementStatus::Fixing, RequirementStatus::Developing)
            | (RequirementStatus::Fixing, RequirementStatus::Cancelled)
            // rejected
            | (RequirementStatus::Rejected, RequirementStatus::Analyzing)
            | (RequirementStatus::Rejected, RequirementStatus::Designed)
            | (RequirementStatus::Rejected, RequirementStatus::Cancelled)
        )
    }

    // ========================================================================
    // 分析与设计
    // ========================================================================

    /// 保存分析结果
    pub fn save_analysis(&mut self, params: SaveAnalysisParams) -> Result<Requirement> {
        let req = self.store.requirements.iter_mut()
            .find(|r| r.id == params.requirement_id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", params.requirement_id)))?;

        req.analysis = Some(params.analysis);
        req.updated_at = Utc::now().timestamp();

        let result = req.clone();
        self.save()?;
        Ok(result)
    }

    /// 保存设计方案
    pub fn save_design(&mut self, params: SaveDesignParams) -> Result<Requirement> {
        let req = self.store.requirements.iter_mut()
            .find(|r| r.id == params.requirement_id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", params.requirement_id)))?;

        let now = Utc::now().timestamp();

        let mut design = req.design.clone().unwrap_or_default();
        if let Some(solution) = params.solution { design.solution = Some(solution); }
        if let Some(technical_notes) = params.technical_notes { design.technical_notes = Some(technical_notes); }
        if let Some(criteria) = params.acceptance_criteria { design.acceptance_criteria = Some(criteria); }
        design.designed_at = now;

        req.design = Some(design);
        req.updated_at = now;

        let result = req.clone();
        self.save()?;
        Ok(result)
    }

    /// 保存原型
    pub fn save_prototype(&mut self, params: SavePrototypeParams) -> Result<PrototypeVersion> {
        let req = self.store.requirements.iter_mut()
            .find(|r| r.id == params.requirement_id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", params.requirement_id)))?;

        let now = Utc::now().timestamp();
        let mut design = req.design.clone().unwrap_or_default();
        let mut prototypes = design.prototypes.unwrap_or_default();

        // 取消之前的当前版本标记
        for p in &mut prototypes {
            p.is_current = false;
        }

        // 计算新版本号
        let new_version = prototypes.len() as u32 + 1;

        let prototype = PrototypeVersion {
            id: Uuid::new_v4().to_string(),
            version: new_version,
            html_content: params.html_content,
            created_at: now,
            note: params.note,
            is_current: true,
        };

        prototypes.push(prototype.clone());
        design.prototypes = Some(prototypes);
        design.designed_at = now;

        req.design = Some(design);
        req.updated_at = now;

        self.save()?;
        Ok(prototype)
    }

    /// 设置当前原型版本
    pub fn set_current_prototype(&mut self, requirement_id: &str, version_id: &str) -> Result<()> {
        let req = self.store.requirements.iter_mut()
            .find(|r| r.id == requirement_id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", requirement_id)))?;

        if let Some(ref mut design) = req.design {
            if let Some(ref mut prototypes) = design.prototypes {
                for p in prototypes.iter_mut() {
                    p.is_current = p.id == version_id;
                }
            }
        }

        req.updated_at = Utc::now().timestamp();
        self.save()?;
        Ok(())
    }

    /// 更新验收标准
    pub fn update_criteria(
        &mut self,
        requirement_id: &str,
        criteria: Vec<AcceptanceCriteria>,
    ) -> Result<()> {
        let req = self.store.requirements.iter_mut()
            .find(|r| r.id == requirement_id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", requirement_id)))?;

        let mut design = req.design.clone().unwrap_or_default();
        design.acceptance_criteria = Some(criteria);
        req.design = Some(design);
        req.updated_at = Utc::now().timestamp();

        self.save()?;
        Ok(())
    }

    // ========================================================================
    // 执行记录
    // ========================================================================

    /// 创建执行记录
    pub fn create_execution(&mut self, params: CreateExecutionParams) -> Result<crate::models::requirement::RequirementExecution> {
        let req = self.store.requirements.iter_mut()
            .find(|r| r.id == params.requirement_id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", params.requirement_id)))?;

        let now = Utc::now().timestamp();
        let phase_str = format!("{:?}", req.status).to_lowercase();

        let execution = crate::models::requirement::RequirementExecution {
            id: Uuid::new_v4().to_string(),
            requirement_id: params.requirement_id.clone(),
            phase: phase_str,
            action: params.action,
            session_id: params.session_id,
            started_at: now,
            finished_at: None,
            status: ExecutionStatus::Running,
            summary: None,
            output: None,
            error: None,
            changed_files: None,
            tool_call_count: None,
            token_count: None,
        };

        req.active_execution_id = Some(execution.id.clone());
        req.executions.push(execution.clone());
        req.updated_at = now;

        self.save()?;
        Ok(execution)
    }

    /// 完成执行记录
    pub fn finish_execution(&mut self, params: FinishExecutionParams) -> Result<()> {
        // 在所有需求中查找执行记录
        for req in &mut self.store.requirements {
            if let Some(exec) = req.executions.iter_mut().find(|e| e.id == params.execution_id) {
                let now = Utc::now().timestamp();
                exec.finished_at = Some(now);
                exec.status = params.status.clone();
                exec.summary = params.summary;
                exec.output = params.output;
                exec.error = params.error;
                exec.changed_files = params.changed_files;
                exec.tool_call_count = params.tool_call_count;
                exec.token_count = params.token_count;
                req.updated_at = now;

                // 如果当前活跃执行是此记录，清除
                if req.active_execution_id.as_deref() == Some(&params.execution_id) {
                    req.active_execution_id = None;
                }

                self.save()?;
                return Ok(());
            }
        }

        Err(AppError::ValidationError(format!("执行记录不存在: {}", params.execution_id)))
    }

    // ========================================================================
    // 子需求
    // ========================================================================

    /// 添加子需求
    pub fn add_sub_requirement(&mut self, requirement_id: &str, title: String) -> Result<SubRequirement> {
        let req = self.store.requirements.iter_mut()
            .find(|r| r.id == requirement_id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", requirement_id)))?;

        let now = Utc::now().timestamp();
        let sub = SubRequirement {
            id: Uuid::new_v4().to_string(),
            title,
            description: None,
            status: "pending".to_string(),
            created_at: now,
            completed_at: None,
        };

        let subs = req.sub_requirements.get_or_insert_with(Vec::new);
        subs.push(sub.clone());
        req.updated_at = now;

        self.save()?;
        Ok(sub)
    }

    /// 切换子需求状态
    pub fn toggle_sub_requirement(&mut self, requirement_id: &str, sub_id: &str) -> Result<()> {
        let req = self.store.requirements.iter_mut()
            .find(|r| r.id == requirement_id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", requirement_id)))?;

        if let Some(ref mut subs) = req.sub_requirements {
            let now = Utc::now().timestamp();
            for sub in subs.iter_mut() {
                if sub.id == sub_id {
                    if sub.status == "completed" {
                        sub.status = "pending".to_string();
                        sub.completed_at = None;
                    } else {
                        sub.status = "completed".to_string();
                        sub.completed_at = Some(now);
                    }
                    break;
                }
            }
        }

        req.updated_at = Utc::now().timestamp();
        self.save()?;
        Ok(())
    }

    /// 删除子需求
    pub fn delete_sub_requirement(&mut self, requirement_id: &str, sub_id: &str) -> Result<()> {
        let req = self.store.requirements.iter_mut()
            .find(|r| r.id == requirement_id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", requirement_id)))?;

        if let Some(ref mut subs) = req.sub_requirements {
            subs.retain(|s| s.id != sub_id);
        }

        req.updated_at = Utc::now().timestamp();
        self.save()?;
        Ok(())
    }

    // ========================================================================
    // 审核
    // ========================================================================

    /// 确认需求（审核门控）
    pub fn approve(&mut self, id: &str) -> Result<Requirement> {
        let req = self.store.requirements.iter_mut()
            .find(|r| r.id == id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", id)))?;

        req.approved = true;
        req.updated_at = Utc::now().timestamp();
        let result = req.clone();
        self.save()?;
        Ok(result)
    }

    /// 批量确认需求
    pub fn batch_approve(&mut self, ids: &[String]) -> Result<usize> {
        let now = Utc::now().timestamp();
        let mut count = 0;
        for req in &mut self.store.requirements {
            if ids.contains(&req.id) && !req.approved {
                req.approved = true;
                req.updated_at = now;
                count += 1;
            }
        }
        if count > 0 {
            self.save()?;
        }
        Ok(count)
    }

    // ========================================================================
    // 统计
    // ========================================================================

    /// 获取统计信息
    pub fn get_stats(&self) -> RequirementStats {
        let total = self.store.requirements.len();
        let mut by_status: HashMap<String, usize> = HashMap::new();
        let mut by_priority: HashMap<String, usize> = HashMap::new();
        let mut by_type: HashMap<String, usize> = HashMap::new();
        let mut completed = 0usize;

        for req in &self.store.requirements {
            let status_key = format!("{:?}", req.status).to_lowercase();
            *by_status.entry(status_key).or_insert(0) += 1;

            let priority_key = format!("{:?}", req.priority).to_lowercase();
            *by_priority.entry(priority_key).or_insert(0) += 1;

            let type_key = format!("{:?}", req.r#type).to_lowercase();
            *by_type.entry(type_key).or_insert(0) += 1;

            if req.status == RequirementStatus::Accepted {
                completed += 1;
            }
        }

        let completion_rate = if total > 0 {
            (completed as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        RequirementStats {
            total,
            by_status,
            by_priority,
            by_type,
            completion_rate,
        }
    }
}
