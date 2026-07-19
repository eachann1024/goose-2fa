use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::AppHandle;

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
    let backup = path.with_extension("json.bak");
    let read = |candidate: &PathBuf| -> Result<Vec<Value>, String> {
        let content = fs::read_to_string(candidate).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    };
    if path.exists() {
        return read(&path).or_else(|primary_error| {
            if backup.exists() {
                read(&backup)
            } else {
                Err(primary_error)
            }
        });
    }
    if backup.exists() {
        return read(&backup);
    }
    Ok(vec![])
}

/// 保存所有账户数据，以格式化 JSON 写入文件
#[tauri::command]
pub fn save_accounts(app: AppHandle, accounts: Vec<Value>) -> Result<(), String> {
    let path = get_storage_path(&app);
    let content = serde_json::to_string_pretty(&accounts).map_err(|e| e.to_string())?;
    let temp = path.with_extension("json.tmp");
    let backup = path.with_extension("json.bak");

    if path.exists() {
        fs::copy(&path, &backup).map_err(|e| e.to_string())?;
    }

    let mut file = fs::File::create(&temp).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;

    #[cfg(windows)]
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    fs::rename(&temp, &path).map_err(|e| e.to_string())?;
    Ok(())
}
