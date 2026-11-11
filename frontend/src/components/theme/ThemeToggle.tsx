import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/format";

export function ThemeToggle({ className, label = true }: { className?: string; label?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border border-line bg-ink-850 px-3 text-slate-500 transition-colors hover:border-line-strong hover:text-slate-200",
        className,
      )}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
      {label ? <span className="hidden font-mono text-3xs uppercase tracking-[0.1em] sm:inline">{dark ? "Light" : "Dark"}</span> : null}
    </button>
  );
}
