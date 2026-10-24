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

/** 分组按住更久才拖，避免一点就换位；账户仍用调用方传入的较短延迟。 */
export class HoldPointerSensor extends PointerSensor {
  constructor(props: PointerSensorProps) {
    const target = props.event.target;
    const isGroup = target instanceof Element && target.closest("[data-group-sortable]") != null;
    super({
      ...props,
      options: {
        ...props.options,
        activationConstraint: isGroup
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
