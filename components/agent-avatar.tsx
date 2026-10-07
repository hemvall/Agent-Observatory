"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AvatarProps } from "@bible-strong/avatar-react";
import type { ComponentType } from "react";
import type { AvatarDefinition } from "@bible-strong/avatar-core";
import { livelyDefinition } from "@/lib/avatars/motion";
import catalog from "@/lib/avatars/index.json";
import "@/vendor/avatar-react/styles.css";
import definition0 from "@/lib/avatars/definitions/0.json";
import definition10 from "@/lib/avatars/definitions/10.json";
import definition12 from "@/lib/avatars/definitions/12.json";
import definition13 from "@/lib/avatars/definitions/13.json";
const cache: Record<string, AvatarDefinition> = {
  Strobi: definition0 as unknown as AvatarDefinition,
  Gemmy: definition10 as unknown as AvatarDefinition,
  Cactee: definition12 as unknown as AvatarDefinition,
  Beebo: definition13 as unknown as AvatarDefinition,
};
const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  Strobi: () => import("@/lib/avatars/definitions/0.json"),
  Freddy: () => import("@/lib/avatars/definitions/1.json"),
  Citrus: () => import("@/lib/avatars/definitions/2.json"),
  Nova: () => import("@/lib/avatars/definitions/3.json"),
  "Grok bot": () => import("@/lib/avatars/definitions/4.json"),
  Sunee: () => import("@/lib/avatars/definitions/5.json"),
  Kirby: () => import("@/lib/avatars/definitions/6.json"),
  Cloudee: () => import("@/lib/avatars/definitions/7.json"),
  Cubee: () => import("@/lib/avatars/definitions/8.json"),
  Onee: () => import("@/lib/avatars/definitions/9.json"),
  Gemmy: () => import("@/lib/avatars/definitions/10.json"),
  Mochi: () => import("@/lib/avatars/definitions/11.json"),
  Cactee: () => import("@/lib/avatars/definitions/12.json"),
  Beebo: () => import("@/lib/avatars/definitions/13.json"),
};
export const AVATAR_NAMES = catalog.map((a) => a.name);
export function AgentAvatar({
  name,
  animation = "idle",
  size = 150,
  lively = false,
}: {
  name: string;
  animation?: string;
  size?: number;
  lively?: boolean;
}) {
  const [AvatarComponent, setAvatarComponent] =
    useState<ComponentType<AvatarProps> | null>(null);
  useEffect(() => {
    let active = true;
    import("@bible-strong/avatar-react")
      .then(({ Avatar }) => {
        if (active) setAvatarComponent(() => Avatar);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const safeName = AVATAR_NAMES.includes(name) ? name : "Strobi";
  const [loaded, setLoaded] = useState<{
    name: string;
    definition: AvatarDefinition;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const definition =
    cache[safeName] || (loaded?.name === safeName ? loaded.definition : null);
  const animatedDefinition = useMemo(() => {
    if (!definition || !lively) return definition;
    return livelyDefinition(definition);
  }, [definition, lively]);
  useEffect(() => {
    let active = true;
    setFailed(false);
    if (!cache[safeName]) {
      loaders[safeName]()
        .then((module) => {
          const value = module.default as AvatarDefinition;
          cache[safeName] = value;
          if (active) setLoaded({ name: safeName, definition: value });
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }
    return () => {
      active = false;
    };
  }, [safeName]);
  if (!definition || !AvatarComponent)
    return (
      <div
        className="avatar-loading"
        style={{ width: size, height: size }}
        role="status"
      >
        {failed ? (
          "Avatar indisponible"
        ) : (
          <Loader2 size={18} className="spin" />
        )}
      </div>
    );
  return (
    <AvatarComponent
      definition={animatedDefinition!}
      animation={animation}
      size={size}
      ariaLabel={`${safeName}, ${animation}`}
    />
  );
}
