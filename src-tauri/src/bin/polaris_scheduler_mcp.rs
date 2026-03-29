//! Scheduler MCP Binary Entry Point
//!
//! Standalone binary for the scheduler MCP server.

fn main() {
    if let Err(error) = run() {
        eprintln!("{}", error.to_message());
        std::process::exit(1);
    }
}

fn run() -> polaris_lib::error::Result<()> {
    let workspace_path = std::env::args()
        .nth(1)
        .ok_or_else(|| polaris_lib::error::AppError::ValidationError("缺少 workspacePath 参数".to_string()))?;

    polaris_lib::services::scheduler_mcp_server::run_scheduler_mcp_server(&workspace_path)
}
