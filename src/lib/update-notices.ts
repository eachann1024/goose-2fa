export interface UpdateNotice {
  id: string;
  version: string;
  date: string;
  items: string[];
}

// 后续更新在数组开头添加一条，使用新的唯一 id，通知入口会重新显示未读标记。
export const UPDATE_NOTICES: UpdateNotice[] = [
  {
    id: "0.1.12",
    version: "0.1.12",
    date: "2026-10-18",
    items: [
      "去掉拖拽把手，按住账户卡片即可拖动排序或移入分组，轻点仍可复制验证码。",
      "新增更新通知，可在顶部铃铛中查看后续更新内容。",
    ],
  },
];
