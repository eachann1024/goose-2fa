# 鹅的验证

主框打 `2fa github` 回车，验证码直接贴到刚才的窗口。助手只能看脱敏账户，永远拿不到种子和动态码。

## 视频介绍

真实运行录屏：浏览器开发预览版加临时测试账户，不是 uTools 里的录屏，也不含真实账户。

https://github.com/user-attachments/assets/5ab572b6-5c74-4549-a24a-26cbcf7d3be2

## 大功能

- **取码即贴**：`2fa github` / `otp 谷歌` 回车，贴到上一窗口；失败才复制。
- **MCP 不给种子**：只读你指定的备份，永不返回种子、otpauth、动态码。
- **吃进迁移码**：粘贴 Google Authenticator 迁移码或 otpauth 链接就能进。
- **备份带分组**：导出带分组、备注、自定义名；卡片可拖到其他一级分组。
- **TOTP 与 HOTP 同一面**：倒计时共享时钟，HOTP 粘贴成功后才安全加计数。

## 当前状态

- 这是 uTools 插件。取码即贴要在 uTools 里用，视频里没有录这一段。
- MCP 只有两个工具：查看摘要、检索账户元数据。它读你手动导出的备份文件，不读实时数据，不能取码，不能写入。
- 界面写着“数据加密存储”，但代码里还没有加密：账户以明文存在 uTools 数据库或浏览器本地，加密还在做。

## 同系列

- [鹅的笔记](https://github.com/eachann1024/goose-notes)
- [鹅的书签](https://github.com/eachann1024/goose-mark)
- [鹅的监控](https://github.com/eachann1024/goose-monitor)
- [鹅的验证](https://github.com/eachann1024/goose-2fa)
- [鹅的 Agent](https://github.com/eachann1024/eachann1024)

## 不做什么

不替你托管密钥，不把验证码传到网上。不是 Tauri 桌面端。

## 参与

改动请开 PR。PR 会先由审核机器人检查。

## 许可

本项目以 [MIT 许可证](LICENSE) 开源，版权所有 © 2026 eachann1024。
