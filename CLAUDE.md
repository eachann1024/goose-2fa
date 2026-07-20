# Goose Note — AGENTS.md


## 验证

- 代码修改后立即执行 `pnpm build`
- 查文档使用 context7

## 组件库

- UI 组件优先使用 shadcn/ui，无覆盖时查 npm 组件库，仍无则手写

## uTools 内核兼容红线

- 当前本机 uTools 7.8.0 包内为 Electron 22.3.27 / Chromium 108.0.5359.215；按 Chrome 108 做兼容，不要按现代 Chrome 判断。
- Chromium 108 不支持 `color-mix()` 与 `oklch()`（Chrome 111 才支持）；Tailwind v4 调色板色、`/alpha` 透明度、`hsl(var(--token)/a)` 很容易编译出这些现代颜色语法。真机里会表现为颜色失效、白块、黑块或 hover/选中态异常。
- uTools UI 禁止在关键视觉链路使用 `color-mix()`、`oklch()`、`lab()`、`lch()`、Tailwind 裸调色板色和 `/alpha` 颜色；用 hex / rgb / 传统 hsl 实色 token，并为 hover / active / selected 预先定义语义变量。
- 前端验收不能只看浏览器 dev：改颜色、hover、选中态后至少 grep `dist`/产物里是否残留 `color-mix|oklch| lab\\(| lch\\(`，再进 uTools 真机看一次。
