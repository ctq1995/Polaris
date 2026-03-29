use chrono::Utc;
use std::path::{Path, PathBuf};

use crate::error::{AppError, Result};
use crate::models::requirement::{
    RequirementCreateParams, RequirementExecuteConfig, RequirementFileData, RequirementItem,
    RequirementPriority, RequirementSource, RequirementStatus, RequirementUpdateParams,
};

const REQUIREMENTS_FILE_RELATIVE_PATH: &str = ".polaris/requirements/requirements.json";
const REQUIREMENTS_FILE_VERSION: &str = "1.0.0";
const PROTOTYPE_DIR_RELATIVE_PATH: &str = ".polaris/requirements/prototypes";

pub struct WorkspaceRequirementRepository {
    workspace_path: PathBuf,
    file_path: PathBuf,
}

impl WorkspaceRequirementRepository {
    pub fn new(workspace_path: impl AsRef<Path>) -> Self {
        let workspace_path = workspace_path.as_ref().to_path_buf();
        Self {
            file_path: workspace_path.join(REQUIREMENTS_FILE_RELATIVE_PATH),
            workspace_path,
        }
    }

    pub fn file_path(&self) -> &Path {
        &self.file_path
    }

    pub fn workspace_path(&self) -> &Path {
        &self.workspace_path
    }

    pub fn list_requirements(&self) -> Result<Vec<RequirementItem>> {
        Ok(self.read_file_data()?.requirements)
    }

    pub fn get_requirement(&self, id: &str) -> Result<Option<RequirementItem>> {
        let data = self.read_file_data()?;
        Ok(data.requirements.into_iter().find(|item| item.id == id))
    }

    pub fn create_requirement(&self, params: RequirementCreateParams) -> Result<RequirementItem> {
        let title = params.title.trim();
        if title.is_empty() {
            return Err(AppError::ValidationError("需求标题不能为空".to_string()));
        }

        let description = params.description.trim();
        if description.is_empty() {
            return Err(AppError::ValidationError("需求描述不能为空".to_string()));
        }

        let mut data = self.read_file_data()?;
        if data.requirements.iter().any(|item| item.title.trim() == title) {
            return Err(AppError::ValidationError(format!("已存在同名需求: {}", title)));
        }

        let now = now_millis();
        let id = uuid::Uuid::new_v4().to_string();
        let has_prototype = params.has_prototype.unwrap_or(false);
        let item = RequirementItem {
            id: id.clone(),
            title: title.to_string(),
            description: description.to_string(),
            status: match params.generated_by.clone().unwrap_or_default() {
                RequirementSource::Ai => RequirementStatus::Pending,
                RequirementSource::User => RequirementStatus::Draft,
            },
            priority: params.priority.unwrap_or_default(),
            tags: sanitize_tags(params.tags),
            prototype_path: has_prototype.then(|| format!(".polaris/requirements/prototypes/{}.html", id)),
            has_prototype,
            generated_by: params.generated_by.unwrap_or_default(),
            generated_at: now,
            generator_task_id: sanitize_optional_string(params.generator_task_id),
            reviewed_at: None,
            review_note: None,
            execute_config: None,
            execute_log: None,
            executed_at: None,
            completed_at: None,
            session_id: None,
            execute_error: None,
            created_at: now,
            updated_at: now,
        };

        data.requirements.push(item.clone());
        self.write_file_data(&mut data)?;
        Ok(item)
    }

    pub fn update_requirement(&self, id: &str, updates: RequirementUpdateParams) -> Result<RequirementItem> {
        let mut data = self.read_file_data()?;
        let requirement = data
            .requirements
            .iter_mut()
            .find(|item| item.id == id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", id)))?;

        if let Some(title) = updates.title {
            let title = title.trim();
            if !title.is_empty() {
                requirement.title = title.to_string();
            }
        }

        if let Some(description) = updates.description {
            let description = description.trim();
            if !description.is_empty() {
                requirement.description = description.to_string();
            }
        }

        if let Some(status) = updates.status {
            let previous = requirement.status.clone();
            requirement.status = status.clone();
            apply_status_side_effects(requirement, &previous, &status);
        }

        if let Some(priority) = updates.priority {
            requirement.priority = priority;
        }

        if let Some(tags) = updates.tags {
            requirement.tags = sanitize_tags(Some(tags));
        }

        if let Some(prototype_path) = updates.prototype_path {
            requirement.prototype_path = sanitize_optional_string(Some(prototype_path));
        }

        if let Some(has_prototype) = updates.has_prototype {
            requirement.has_prototype = has_prototype;
            if !has_prototype {
                requirement.prototype_path = None;
            }
        }

        if let Some(review_note) = updates.review_note {
            requirement.review_note = sanitize_optional_string(Some(review_note));
        }

        if let Some(execute_config) = updates.execute_config {
            requirement.execute_config = Some(sanitize_execute_config(execute_config));
        }

        if let Some(execute_log) = updates.execute_log {
            requirement.execute_log = sanitize_optional_string(Some(execute_log));
        }

        if let Some(execute_error) = updates.execute_error {
            requirement.execute_error = sanitize_optional_string(Some(execute_error));
        }

        if let Some(generated_by) = updates.generated_by {
            requirement.generated_by = generated_by;
        }

        if let Some(session_id) = updates.session_id {
            requirement.session_id = sanitize_optional_string(Some(session_id));
        }

        requirement.updated_at = now_millis();
        let result = requirement.clone();
        self.write_file_data(&mut data)?;
        Ok(result)
    }

    pub fn delete_requirement(&self, id: &str) -> Result<RequirementItem> {
        let mut data = self.read_file_data()?;
        let index = data
            .requirements
            .iter()
            .position(|item| item.id == id)
            .ok_or_else(|| AppError::ValidationError(format!("需求不存在: {}", id)))?;
        let removed = data.requirements.remove(index);
        self.write_file_data(&mut data)?;
        Ok(removed)
    }

    pub fn save_prototype(&self, id: &str, html: &str) -> Result<String> {
        let full_dir = self.workspace_path.join(PROTOTYPE_DIR_RELATIVE_PATH);
        std::fs::create_dir_all(&full_dir)?;
        let relative_path = format!(".polaris/requirements/prototypes/{}.html", id);
        let full_path = self.workspace_path.join(&relative_path);
        std::fs::write(&full_path, html)?;
        let _ = self.update_requirement(
            id,
            RequirementUpdateParams {
                prototype_path: Some(relative_path.clone()),
                has_prototype: Some(true),
                ..Default::default()
            },
        )?;
        Ok(relative_path)
    }

    fn read_file_data(&self) -> Result<RequirementFileData> {
        if !self.file_path.exists() {
            let mut empty = create_empty_requirement_file_data();
            self.write_file_data(&mut empty)?;
            return Ok(empty);
        }

        let content = std::fs::read_to_string(&self.file_path)?;
        let raw_json: serde_json::Value = serde_json::from_str(&content)
            .unwrap_or_else(|_| serde_json::json!({}));

        let normalized = normalize_file_data(raw_json);
        self.persist_if_changed(&normalized)?;
        Ok(normalized)
    }

    fn write_file_data(&self, data: &mut RequirementFileData) -> Result<()> {
        data.version = REQUIREMENTS_FILE_VERSION.to_string();
        data.updated_at = now_iso();

        if let Some(parent) = self.file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(data)?;
        std::fs::write(&self.file_path, format!("{}\n", content))?;
        Ok(())
    }

    fn persist_if_changed(&self, normalized: &RequirementFileData) -> Result<()> {
        let serialized = format!("{}\n", serde_json::to_string_pretty(normalized)?);
        let current = std::fs::read_to_string(&self.file_path).unwrap_or_default();
        if current != serialized {
            if let Some(parent) = self.file_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&self.file_path, serialized)?;
        }
        Ok(())
    }
}

fn apply_status_side_effects(
    requirement: &mut RequirementItem,
    previous: &RequirementStatus,
    next: &RequirementStatus,
) {
    let now = now_millis();

    if matches!(next, RequirementStatus::Approved | RequirementStatus::Rejected)
        && matches!(previous, RequirementStatus::Draft | RequirementStatus::Pending)
    {
        requirement.reviewed_at = Some(now);
    }

    if matches!(next, RequirementStatus::Executing) && !matches!(previous, RequirementStatus::Executing) {
        requirement.executed_at = Some(now);
    }

    if matches!(next, RequirementStatus::Completed) && !matches!(previous, RequirementStatus::Completed) {
        requirement.completed_at = Some(now);
    }

    if !matches!(next, RequirementStatus::Completed) {
        requirement.completed_at = requirement.completed_at.filter(|_| matches!(next, RequirementStatus::Completed));
    }
}

fn create_empty_requirement_file_data() -> RequirementFileData {
    RequirementFileData {
        version: REQUIREMENTS_FILE_VERSION.to_string(),
        updated_at: now_iso(),
        requirements: Vec::new(),
    }
}

fn normalize_file_data(raw_json: serde_json::Value) -> RequirementFileData {
    let version = raw_json
        .get("version")
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(REQUIREMENTS_FILE_VERSION)
        .to_string();

    let updated_at = raw_json
        .get("updatedAt")
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
        .unwrap_or_else(now_iso);

    let requirements = raw_json
        .get("requirements")
        .and_then(|value| value.as_array())
        .map(|items| items.iter().filter_map(normalize_requirement_item).collect())
        .unwrap_or_default();

    RequirementFileData {
        version,
        updated_at,
        requirements,
    }
}

fn normalize_requirement_item(raw: &serde_json::Value) -> Option<RequirementItem> {
    let id = raw.get("id")?.as_str()?.trim();
    if id.is_empty() {
        return None;
    }

    let now = now_millis();
    let title = raw.get("title").and_then(|value| value.as_str()).unwrap_or(id).trim().to_string();
    let description = raw.get("description").and_then(|value| value.as_str()).unwrap_or_default().to_string();
    let status = raw
        .get("status")
        .and_then(|value| value.as_str())
        .and_then(parse_status)
        .unwrap_or_default();
    let priority = raw
        .get("priority")
        .and_then(|value| value.as_str())
        .and_then(parse_priority)
        .unwrap_or_default();
    let generated_by = raw
        .get("generatedBy")
        .and_then(|value| value.as_str())
        .and_then(parse_source)
        .unwrap_or_default();
    let tags = raw
        .get("tags")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::trim).filter(|item| !item.is_empty()).map(str::to_string))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let prototype_path = raw.get("prototypePath").and_then(|value| value.as_str()).map(|value| value.to_string());
    let has_prototype = raw.get("hasPrototype").and_then(|value| value.as_bool()).unwrap_or(prototype_path.is_some());

    Some(RequirementItem {
        id: id.to_string(),
        title,
        description,
        status,
        priority,
        tags,
        prototype_path,
        has_prototype,
        generated_by,
        generated_at: raw.get("generatedAt").and_then(|value| value.as_i64()).unwrap_or(now),
        generator_task_id: raw.get("generatorTaskId").and_then(|value| value.as_str()).map(|value| value.to_string()),
        reviewed_at: raw.get("reviewedAt").and_then(|value| value.as_i64()),
        review_note: raw.get("reviewNote").and_then(|value| value.as_str()).map(|value| value.to_string()),
        execute_config: raw.get("executeConfig").and_then(normalize_execute_config),
        execute_log: raw.get("executeLog").and_then(|value| value.as_str()).map(|value| value.to_string()),
        executed_at: raw.get("executedAt").and_then(|value| value.as_i64()),
        completed_at: raw.get("completedAt").and_then(|value| value.as_i64()),
        session_id: raw.get("sessionId").and_then(|value| value.as_str()).map(|value| value.to_string()),
        execute_error: raw.get("executeError").and_then(|value| value.as_str()).map(|value| value.to_string()),
        created_at: raw.get("createdAt").and_then(|value| value.as_i64()).unwrap_or(now),
        updated_at: raw.get("updatedAt").and_then(|value| value.as_i64()).unwrap_or(now),
    })
}

fn normalize_execute_config(raw: &serde_json::Value) -> Option<RequirementExecuteConfig> {
    let object = raw.as_object()?;
    Some(RequirementExecuteConfig {
        scheduled_at: object.get("scheduledAt").and_then(|value| value.as_i64()),
        engine_id: object.get("engineId").and_then(|value| value.as_str()).map(|value| value.to_string()),
        work_dir: object.get("workDir").and_then(|value| value.as_str()).map(|value| value.to_string()),
    })
}

fn sanitize_tags(tags: Option<Vec<String>>) -> Vec<String> {
    tags.unwrap_or_default()
        .into_iter()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect()
}

fn sanitize_optional_string(value: Option<String>) -> Option<String> {
    value.map(|value| value.trim().to_string()).filter(|value| !value.is_empty())
}

fn sanitize_execute_config(config: RequirementExecuteConfig) -> RequirementExecuteConfig {
    RequirementExecuteConfig {
        scheduled_at: config.scheduled_at,
        engine_id: sanitize_optional_string(config.engine_id),
        work_dir: sanitize_optional_string(config.work_dir),
    }
}

fn parse_status(value: &str) -> Option<RequirementStatus> {
    match value {
        "draft" => Some(RequirementStatus::Draft),
        "pending" => Some(RequirementStatus::Pending),
        "approved" => Some(RequirementStatus::Approved),
        "rejected" => Some(RequirementStatus::Rejected),
        "executing" => Some(RequirementStatus::Executing),
        "completed" => Some(RequirementStatus::Completed),
        "failed" => Some(RequirementStatus::Failed),
        _ => None,
    }
}

fn parse_priority(value: &str) -> Option<RequirementPriority> {
    match value {
        "low" => Some(RequirementPriority::Low),
        "normal" => Some(RequirementPriority::Normal),
        "high" => Some(RequirementPriority::High),
        "urgent" => Some(RequirementPriority::Urgent),
        _ => None,
    }
}

fn parse_source(value: &str) -> Option<RequirementSource> {
    match value {
        "ai" => Some(RequirementSource::Ai),
        "user" => Some(RequirementSource::User),
        _ => None,
    }
}

fn now_millis() -> i64 {
    Utc::now().timestamp_millis()
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}
