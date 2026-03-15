/**
 * LSP 服务模块
 */

mod manager;
mod installer;

pub use manager::{LSPManager, LSPServerHandle};
pub use installer::{LSPInstaller, detect_rust_analyzer};
