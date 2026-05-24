use serde_json::Value;
use tauri::AppHandle;
use std::fs;
use std::path::PathBuf;

/// 获取账户数据存储路径
/// macOS: ~/Library/Application Support/com.goose2fa.app/accounts.json
fn get_storage_path(_app: &AppHandle) -> PathBuf {
    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.goose2fa.app");
    // 确保目录存在
    fs::create_dir_all(&app_dir).ok();
    app_dir.join("accounts.json")
}

/// 加载所有账户数据，文件不存在时返回空数组
#[tauri::command]
pub fn load_accounts(app: AppHandle) -> Result<Vec<Value>, String> {
    let path = get_storage_path(&app);
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let accounts: Vec<Value> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(accounts)
}

/// 保存所有账户数据，以格式化 JSON 写入文件
#[tauri::command]
pub fn save_accounts(app: AppHandle, accounts: Vec<Value>) -> Result<(), String> {
    let path = get_storage_path(&app);
    let content = serde_json::to_string_pretty(&accounts).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}
