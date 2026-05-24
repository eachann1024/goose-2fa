use serde::Serialize;

/// 剪贴板图片数据，包含宽高和 RGBA 像素
#[derive(Serialize)]
pub struct ClipboardImage {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

/// 从系统剪贴板读取图片
/// 返回 None 表示剪贴板中没有图片
/// arboard v3: ImageData { width: usize, height: usize, bytes: Cow<[u8]> }
/// bytes 为 RGBA 像素数据，长度 = width * height * 4
#[tauri::command]
pub fn read_clipboard_image() -> Result<Option<ClipboardImage>, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    match clipboard.get_image() {
        Ok(image) => {
            Ok(Some(ClipboardImage {
                width: image.width as u32,
                height: image.height as u32,
                data: image.into_owned_bytes().into_owned(),
            }))
        }
        Err(_) => Ok(None),
    }
}
