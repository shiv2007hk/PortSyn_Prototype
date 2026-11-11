import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/format";
import { LogoMark } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AuthScene } from "./AuthScene";

export function AuthLayout({
  variant,
  title,
  subtitle,
  children,
  footer,
}: {
  variant: "login" | "signup";
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-ink-900 lg:grid-cols-[1.05fr_0.95fr]">
      <AuthScene variant={variant} />

      <div className="relative flex min-h-screen flex-col">
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-ink-850 px-3 text-[11.5px] font-medium text-slate-400 transition-colors hover:text-slate-100"
          >
            <ArrowLeft size={13} /> Home
          </Link>
          <ThemeToggle label={false} className="h-9 w-9 justify-center px-0" />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-14 sm:px-8">
          <div className="w-full max-w-[404px]">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <LogoMark size={32} />
              <div className="leading-none">
                <div className="font-display text-[15px] font-bold tracking-[0.16em] text-slate-50">PORTSYNC</div>
                <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.16em] text-slate-500">Smart port operations</div>
              </div>
            </div>

            <div className="hidden items-center gap-2.5 lg:flex">
              <LogoMark size={30} />
              <span className="font-display text-[13px] font-bold tracking-[0.18em] text-slate-100">PORTSYNC</span>
            </div>

            <h1 className="editorial-title mt-6 text-[30px] text-slate-50 sm:text-[34px]">{title}</h1>
            <div className="mt-2 text-[13px] leading-relaxed text-slate-400">{subtitle}</div>

            <div className="mt-8">{children}</div>

            <div className="mt-7 border-t border-line pt-5 text-center text-[12px] text-slate-500">{footer}</div>

            <p className="mt-6 text-center font-mono text-[8.5px] uppercase leading-relaxed tracking-[0.12em] text-slate-600">
              Demonstration environment · operational data is simulated
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthField({
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={props.id} className="text-[11.5px] font-medium text-slate-300">
          {label}
        </label>
        {hint ? <span className="text-[10.5px] text-slate-500">{hint}</span> : null}
      </div>
      <input
        {...props}
        className={cn(
          "h-11 w-full rounded-lg border bg-ink-850 px-3 text-[13px] text-slate-100 placeholder:text-slate-600 transition-colors focus:outline-none focus:ring-2",
          error
            ? "border-red-500/50 focus:border-red-400 focus:ring-red-500/15"
            : "border-line-strong focus:border-marine-500 focus:ring-marine-500/20",
          props.className,
        )}
      />
      {error ? <p className="mt-1.5 text-[11px] text-red-400">{error}</p> : null}
    </div>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete,
  placeholder,
  hint,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: ReactNode;
  id: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[11.5px] font-medium text-slate-300">
          {label}
        </label>
        {hint ? <span className="text-[10.5px] text-slate-500">{hint}</span> : null}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={cn(
            "h-11 w-full rounded-lg border bg-ink-850 pl-3 pr-10 text-[13px] text-slate-100 placeholder:text-slate-600 transition-colors focus:outline-none focus:ring-2",
            error
              ? "border-red-500/50 focus:border-red-400 focus:ring-red-500/15"
              : "border-line-strong focus:border-marine-500 focus:ring-marine-500/20",
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:text-slate-200"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error ? <p className="mt-1.5 text-[11px] text-red-400">{error}</p> : null}
    </div>
  );
}
