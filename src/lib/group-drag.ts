import {
  closestCenter,
  pointerWithin,
  PointerSensor,
  type CollisionDetection,
  type Modifier,
  type PointerSensorProps,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";

export const GROUP_DND_PREFIX = "group:";

export function groupDndId(id: string): string {
  return `${GROUP_DND_PREFIX}${id}`;
}

/** 鼠标按住移动即可拖动；触屏保留长按，避免滚动时误拖。 */
export class HoldPointerSensor extends PointerSensor {
  constructor(props: PointerSensorProps) {
    const target = props.event.target;
    const isGroup = target instanceof Element && target.closest("[data-group-sortable]") != null;
    const isMouse = "pointerType" in props.event && props.event.pointerType === "mouse";
    super({
      ...props,
      options: {
        ...props.options,
        activationConstraint: isMouse
          ? { distance: 6 }
          : isGroup
            ? { delay: 400, tolerance: 6 }
            : props.options.activationConstraint,
      },
    });
  }
}

/** 分组只沿横条移动，避免浮层把落点从指针下拽走。 */
export const groupAxisModifier: Modifier = (args) => {
  if (args.active?.data.current?.type !== "group") return args.transform;
  return restrictToHorizontalAxis(args);
};

/** 拖分组时只和分组碰撞，指针稍稍偏出横条也不会把让位打乱。 */
export const groupAwareCollision: CollisionDetection = (args) => {
  if (args.active.data.current?.type === "group") {
    const groups = args.droppableContainers.filter((container) =>
      String(container.id).startsWith(GROUP_DND_PREFIX),
    );
    const scoped = { ...args, droppableContainers: groups };
    const hits = pointerWithin(scoped);
    return hits.length > 0 ? hits : closestCenter(scoped);
  }
  const pointerHits = pointerWithin(args);
  return pointerHits.length > 0 ? pointerHits : closestCenter(args);
};
