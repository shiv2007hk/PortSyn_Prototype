import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Check, KeyRound, Loader2, ShieldCheck, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/rbac";
import { AuthField, AuthLayout, PasswordField } from "@/components/auth/AuthLayout";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<string>("super_admin");

  if (user) return <Navigate to="/app" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password, remember);
      navigate("/app", { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Sign in failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (acc: DemoAccount) => {
    setSelectedDemo(acc.role);
    setEmail(acc.email);
    setPassword("PortSync2026!");
    setErrors({});
    setServerError(null);
  };

  const quickLoginAs = async (acc: DemoAccount) => {
    setSelectedDemo(acc.role);
    setEmail(acc.email);
    setPassword("PortSync2026!");
    setErrors({});
    setServerError(null);
    setLoading(true);
    try {
      await login(acc.email, "PortSync2026!", remember);
      navigate("/app", { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Sign in failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      variant="login"
      title="Welcome back."
      subtitle={
        <>
          Sign in to the Terminal 2 operations workspace.
          <span className="mt-1 block text-[11.5px] text-slate-500">
            Session access is role-verified on the server and audited.
          </span>
        </>
      }
      footer={
        <>
          New to PortSync?{" "}
          <Link to="/signup" className="font-medium text-marine-400 transition-colors hover:text-marine-300">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {serverError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/[0.07] px-3 py-2.5 text-[12px] leading-relaxed text-red-300"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{serverError}</span>
          </div>
        ) : null}

        <AuthField
          id="login-email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />

        <PasswordField
          id="login-password"
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          hint={
            <button
              type="button"
              onClick={() => setForgot((value) => !value)}
              className="transition-colors hover:text-slate-300"
            >
              Forgot password?
            </button>
          }
        />

        {forgot ? (
          <div className="rounded-lg border border-line bg-ink-850 px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-400">
            Password recovery is handled by the port administrator. In this demonstration environment you can use any of
            the seeded demo credentials below.
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-[12px] text-slate-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-line-strong bg-ink-850 accent-marine-500"
            />
            Remember this device
          </label>
          <button
            type="button"
            onClick={() => {
              const defaultAcc = DEMO_ACCOUNTS.find((a) => a.role === selectedDemo) ?? DEMO_ACCOUNTS[0];
              fillDemo(defaultAcc);
            }}
            className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 transition-colors hover:text-slate-300"
          >
            <KeyRound size={12} /> Fill credentials
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-marine-600 text-[13px] font-semibold text-white shadow-[0_16px_36px_-20px_rgba(37,99,235,0.9)] transition-all hover:bg-marine-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : null}
          {loading ? "Signing in…" : "Sign in"}
          {!loading ? <ArrowRight size={14} /> : null}
        </button>
      </form>

      {/* Expanded Multi-Role Demo Logins */}
      <div className="mt-5 rounded-lg border border-line bg-ink-850/80 p-3">
        <div className="flex items-center justify-between border-b border-line/70 pb-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-cyan-400" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400">
              Seeded Demo Role Logins
            </span>
          </div>
          <span className="rounded bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em] text-cyan-400">
            Click to Sign In
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {DEMO_ACCOUNTS.map((acc) => {
            const isSelected = email.toLowerCase() === acc.email.toLowerCase() || selectedDemo === acc.role;
            return (
              <button
                key={acc.role}
                type="button"
                disabled={loading}
                onClick={() => quickLoginAs(acc)}
                title={`Sign in as ${acc.title} (${acc.email})`}
                className={`group relative flex flex-col justify-between rounded border p-2 text-left transition-all ${
                  isSelected
                    ? "border-marine-500/70 bg-marine-500/10 shadow-[0_0_12px_-4px_rgba(37,99,235,0.4)]"
                    : "border-line bg-ink-900/50 hover:border-line-strong hover:bg-ink-800"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[11px] font-semibold text-slate-200 group-hover:text-white">
                      {acc.title}
                    </span>
                    <Zap size={10} className="shrink-0 text-amber-400 opacity-60 group-hover:opacity-100" />
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[9px] text-slate-400">
                    {acc.name.split(" ")[0]} · {acc.role.replace(/_/g, " ")}
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between border-t border-line/40 pt-1 font-mono text-[8px] text-slate-500">
                  <span className="truncate">{acc.email}</span>
                  {isSelected ? <Check size={10} className="shrink-0 text-cyan-400" /> : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
          <span>Password: <code className="rounded bg-ink-750 px-1 py-0.5 font-mono text-slate-300">PortSync2026!</code></span>
          <span className="font-mono text-3xs text-slate-600">Standard server auth</span>
        </div>
      </div>
    </AuthLayout>
  );
}
