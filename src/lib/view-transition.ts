export type ViewState = "idle" | "opening" | "open" | "closing";

/** 主列表在「打开/关闭详情」两段动画里的景深状态。 */
export function listFaceClass(viewState: ViewState): string {
  return [
    "view-face view-list flex min-h-0 flex-col bg-bg",
    viewState === "opening" ? "is-leaving" : "",
    viewState === "closing" ? "is-entering" : "",
    viewState === "open" ? "pointer-events-none opacity-0" : "",
  ].join(" ");
}

/** 详情面从列表后方落下的景深状态。 */
export function detailFaceClass(viewState: ViewState): string {
  return [
    "view-face view-detail",
    viewState === "opening" ? "is-entering" : "",
    viewState === "closing" ? "is-leaving" : "",
    viewState === "idle" ? "pointer-events-none" : "",
    viewState === "open" ? "!transform-none !opacity-100" : "",
  ].join(" ");
}
