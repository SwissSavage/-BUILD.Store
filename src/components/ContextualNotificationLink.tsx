"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ComponentProps } from "react";
import { markContextualNotificationsRead } from "@/lib/notification-actions";
import type { ContextualNotificationArea } from "@/lib/contextual-notifications";

type Props = ComponentProps<typeof Link> & {
  area?: ContextualNotificationArea;
};

/**
 * A normal navigation link that acknowledges only the category the
 * member intentionally opened. Modified clicks preserve native link behavior.
 */
export function ContextualNotificationLink({ area, onClick, ...props }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (
          !area ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) return;

        event.preventDefault();
        startTransition(async () => {
          await markContextualNotificationsRead(area);
          router.push(String(props.href));
        });
      }}
    />
  );
}
