"use client";

import { Icon, type IconName } from "./Icon";
import { useTheme, type Theme } from "./ThemeProvider";

const options: { value: Theme; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" },
];

export function ThemeToggle({
  className = "",
  showLabels = false,
}: {
  className?: string;
  showLabels?: boolean;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Appearance"
      className={`inline-flex rounded-full border border-border bg-surface-soft p-1 ${className}`}
    >
      {options.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
            title={option.label}
            suppressHydrationWarning
            className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition ${
              active
                ? "bg-surface text-text shadow-[0_1px_3px_rgba(70,45,58,0.14)]"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Icon name={option.icon} size={13} />
            {showLabels && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
