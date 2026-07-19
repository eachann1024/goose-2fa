use std::fs;
use std::path::Path;

const MAX_IMPORT_BYTES: u64 = 20 * 1024 * 1024;

fn has_extension(path: &str, allowed: &[&str]) -> bool {
    Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            allowed
                .iter()
                .any(|allowed| extension.eq_ignore_ascii_case(allowed))
        })
        .unwrap_or(false)
}

/// 将内容写入指定路径的文件
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    if !has_extension(&path, &["json"]) {
        return Err("仅允许写入 JSON 备份文件".into());
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// 读取指定路径文件的全部内容
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    if !has_extension(&path, &["json", "txt"]) {
        return Err("仅允许读取 JSON 或文本备份文件".into());
    }
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    if metadata.len() > MAX_IMPORT_BYTES {
        return Err("备份文件超过 20 MB 限制".into());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}
