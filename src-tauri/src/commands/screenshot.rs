use screenshots::Screen;

/// 截取主屏幕并返回 base64 编码的 PNG 图片
#[tauri::command]
pub fn capture_screen() -> Result<String, String> {
    // 获取所有屏幕，取第一个（主屏幕）
    let screens = Screen::all().map_err(|e| e.to_string())?;
    let screen = screens.first().ok_or("No screen found")?;

    // 截取屏幕画面
    let image = screen.capture().map_err(|e| e.to_string())?;

    // screenshots::Image -> image::RgbaImage
    let rgba_image = image::RgbaImage::from_raw(
        image.width(),
        image.height(),
        image.as_raw().clone(),
    ).ok_or("Failed to create RGBA image")?;

    // 编码为 PNG 并转为 base64
    let mut png_data = Vec::new();
    rgba_image
        .write_to(&mut std::io::Cursor::new(&mut png_data), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &png_data,
    ))
}
