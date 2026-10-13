/**
 * uTools vendor 分包策略。
 *
 * Vite 8 底层用 rolldown，rollup 的 `output.manualChunks` 会被忽略，
 * 必须用 rolldown 原生的 `output.codeSplitting.groups`
 * （配 `rolldownOptions.output` 使用；旧名 advancedChunks 已 deprecated）。
 *
 * 目标：把体积大、更新频率低的第三方库拆成独立 chunk，避免业务代码改动
 * 触发整包失效，并让首屏 bundle 更小、缓存命中更稳。
 *
 * priority 越大越先匹配；命中后该模块从其它组移除。test 用 `[\\/]`
 * 兼容 Windows 路径分隔符（rolldown 官方建议）。
 *
 * 仅为实际使用的依赖设置独立分组，其余模块由 vendor 兜底。
 */
export const codeSplittingGroups = [
  // React 运行时（react / react-dom / scheduler）—— 最稳定，单独长期缓存
  {
    name: "react-vendor",
    test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-is)[\\/]/,
    priority: 50,
  },
  // @base-ui/react —— 在用组件的底层无障碍原语
  {
    name: "base-ui",
    test: /[\\/]node_modules[\\/]@base-ui[\\/]/,
    priority: 40,
  },
  // 图标库 —— 即便按需引入也常占可观体积，拆出便于观测
  {
    name: "icons",
    test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
    priority: 30,
  },
  // 其余第三方统一归入 vendor（兜底，优先级最低）
  {
    name: "vendor",
    test: /[\\/]node_modules[\\/]/,
    priority: 1,
  },
];
