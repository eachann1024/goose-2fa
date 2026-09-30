> **已迁入 [Goose Hub](/Users/eachann/Work/goose-hub)。** 数据目录为 `~/.config/2fa`。本仓库的 uTools 版以 tag `utools-last` 冻结，需要回滚时检出该 tag。

# 鹅的验证

主框打 `2fa github` 回车，验证码直接贴到刚才的窗口。助手只能看脱敏账户，永远拿不到种子和动态码。

## 视频介绍

[![中文产品介绍视频](docs/media/product-intro-cover.png)](https://github.com/eachann1024/goose-2fa/raw/refs/heads/main/docs/media/product-intro-zh.mp4)

[观看／下载 MP4](https://github.com/eachann1024/goose-2fa/raw/refs/heads/main/docs/media/product-intro-zh.mp4) · 中文旁白 · 1080p · 40 秒

**源码界面预览·虚构演示数据**。展示账户搜索、分组、取码界面及导入导出入口；MCP 脱敏能力依据源码说明，未连接执行。已迁入 Goose Hub。基于 goose-2fa `53a42855dfc184a2841caffe8fa4697caa55dbce` 与 Hub `f298eb8936e57073f2e34bd59bf211e8ee9ba66a` 的组件源码。

## 大功能

- **取码即贴**：`2fa github` / `otp 谷歌` 回车，贴到上一窗口；失败才复制。
- **MCP 不给种子**：只读你指定的备份，永不返回种子、otpauth、动态码。
- **吃进迁移码**：粘贴 Google Authenticator 迁移码或 otpauth 链接就能进。
- **备份带分组**：导出带分组、备注、自定义名；卡片可拖到其他一级分组。
- **TOTP 与 HOTP 同一面**：倒计时共享时钟，HOTP 粘贴成功后才安全加计数。

## 同系列

- [鹅的笔记](https://github.com/eachann1024/goose-notes)
- [鹅的书签](https://github.com/eachann1024/goose-mark)
- [鹅的监控](https://github.com/eachann1024/goose-monitor)
- [鹅的验证](https://github.com/eachann1024/goose-2fa)
- [鹅的 Agent](https://github.com/eachann1024/eachann1024)

## 不做什么

不替你托管密钥，不把验证码传到网上。不是 Tauri 桌面端。

## 许可

本项目以 [MIT 许可证](LICENSE) 开源，版权所有 © 2026 eachann1024。
