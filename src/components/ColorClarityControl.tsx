"use client";

import { Accessibility } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";

const STORAGE_KEY = "fm-color-clarity";

function applyColorClarity(enabled: boolean) {
  if (enabled) {
    document.documentElement.dataset.colorClarity = "on";
  } else {
    delete document.documentElement.dataset.colorClarity;
  }
}

/**
 * A user-controlled, high-contrast colour mode. It is intentionally not a
 * colour-blindness simulator: it removes hue as a prerequisite for reading
 * the interface and persists the preference across routes and visits.
 */
export function ColorClarityControl() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) === "on";
    applyColorClarity(saved);
    setEnabled(saved);
  }, []);

  function toggle() {
    const next = !enabled;
    window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    applyColorClarity(next);
    setEnabled(next);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="default"
      aria-pressed={enabled}
      aria-label={`${enabled ? "Disable" : "Enable"} color clarity mode`}
      onClick={toggle}
      className="fixed bottom-4 left-4 z-50 shadow-lg shadow-black/30"
    >
      <Accessibility aria-hidden="true" size={18} strokeWidth={1.8} />
      <span>Color clarity{enabled ? ": on" : ""}</span>
    </Button>
  );
}
