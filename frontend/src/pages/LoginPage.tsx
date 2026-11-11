import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
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

  const fillDemo = () => {
    setEmail("priya.menon@portsync.demo");
    setPassword("PortSync2026!");
    setErrors({});
    setServerError(null);
  };

  return (
    <AuthLayout
      variant="login"
      title="Welcome back."
      subtitle={
        <>
          Sign in to the Terminal 2 operations workspace.
          <span className="mt-1 block text-[11.5px] text-slate-500">Session access is authenticated on the server and audited.</span>
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
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/[0.07] px-3 py-2.5 text-[12px] leading-relaxed text-red-300">
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
            <button type="button" onClick={() => setForgot((value) => !value)} className="transition-colors hover:text-slate-300">
              Forgot password?
            </button>
          }
        />

        {forgot ? (
          <div className="rounded-lg border border-line bg-ink-850 px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-400">
            Password recovery is handled by the port administrator. In this demonstration environment you can use the seeded
            supervisor credentials below.
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
          <button type="button" onClick={fillDemo} className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 transition-colors hover:text-slate-300">
            <KeyRound size={12} /> Use demo credentials
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

      <div className="mt-5 rounded-lg border border-line bg-ink-850/70 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-slate-500">Seeded demonstration access</span>
          <span className="rounded bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em] text-cyan-400">Demo</span>
        </div>
        <div className="mt-1.5 grid gap-0.5 font-mono text-[10.5px] text-slate-400">
          <span>priya.menon@portsync.demo</span>
          <span className="text-slate-600">PortSync2026! · supervisor role</span>
        </div>
      </div>
    </AuthLayout>
  );
}
