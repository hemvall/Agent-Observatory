import type { AvatarDefinition } from "@bible-strong/avatar-core";

/** Keep Avatar Lab's original poses; shorten holds so actions are visible between steps. */
export function livelyDefinition(
  definition: AvatarDefinition,
): AvatarDefinition {
  return {
    ...definition,
    animations: Object.fromEntries(
      Object.entries(definition.animations).map(([key, value]) => [
        key,
        {
          ...value,
          steps: value.steps.map((step) => ({
            ...step,
            holdMs: Math.max(700, Math.round(step.holdMs * 0.45)),
            transitionMs: Math.max(250, Math.round(step.transitionMs * 0.85)),
          })),
        },
      ]),
    ),
  };
}
