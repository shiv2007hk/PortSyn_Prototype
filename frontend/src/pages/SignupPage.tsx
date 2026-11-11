import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Check, Eye, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/format";
import { AuthField, AuthLayout, PasswordField } from "@/components/auth/AuthLayout";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordScore(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, score);
}

const STRENGTH_LABEL = ["Too short", "Weak", "Fair", "Strong", "Very strong"];
const STRENGTH_TONE = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-emerald-500", "bg-cyan-400"];

export function SignupPage() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [terms, setTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const score = useMemo(() => passwordScore(form.password), [form.password]);

  if (user) return <Navigate to="/app" replace />;

  const update = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Enter your full name.";
    if (!EMAIL_RE.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.password.length < 8) next.password = "Use at least 8 characters.";
    if (form.confirm !== form.password) next.confirm = "Passwords do not match.";
    if (!terms) next.terms = "Accept the terms to continue.";
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await signup(form.name.trim(), form.email.trim().toLowerCase(), form.password);
      navigate("/app", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed. Try again.";
      if (/exists/i.test(message)) setErrors({ email: message });
      else setServerError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      variant="signup"
      title="Create your account."
      subtitle={
        <>
          Start with read-only access to the Terminal 2 demonstration workspace.
          <span className="mt-1 block text-[11.5px] text-slate-500">Operator permissions are granted by a supervisor.</span>
        </>
      }
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-marine-400 transition-colors hover:text-marine-300">
            Sign in
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
          id="signup-name"
          label="Full name"
          autoComplete="name"
          placeholder="Alex Fernandes"
          value={form.name}
          onChange={(event) => update("name")(event.target.value)}
          error={errors.name}
        />

        <AuthField
          id="signup-email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={(event) => update("email")(event.target.value)}
          error={errors.email}
        />

        <div>
          <PasswordField
            id="signup-password"
            label="Password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={update("password")}
            error={errors.password}
            hint={<span className="font-mono text-[9.5px] uppercase tracking-[0.08em]">{STRENGTH_LABEL[score]}</span>}
          />
          <div className="mt-2 grid grid-cols-4 gap-1">
            {[0, 1, 2, 3].map((index) => (
              <span key={index} className={cn("h-1 rounded-full transition-colors", form.password && index < score ? STRENGTH_TONE[score] : "bg-ink-600")} />
            ))}
          </div>
        </div>

        <PasswordField
          id="signup-confirm"
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={form.confirm}
          onChange={update("confirm")}
          error={errors.confirm}
        />

        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-[11.5px] leading-relaxed text-slate-400">
            <input
              type="checkbox"
              checked={terms}
              onChange={(event) => setTerms(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong bg-ink-850 accent-marine-500"
            />
            <span>
              I accept the demonstration terms and understand that operational data in this environment is simulated.
            </span>
          </label>
          {errors.terms ? <p className="mt-1.5 text-[11px] text-red-400">{errors.terms}</p> : null}
          <button type="button" onClick={() => setShowTerms((value) => !value)} className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] text-slate-500 hover:text-slate-300">
            <Eye size={11} /> {showTerms ? "Hide" : "Read"} the terms summary
          </button>
          {showTerms ? (
            <div className="mt-2 space-y-1.5 rounded-lg border border-line bg-ink-850 px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
              <p className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0 text-emerald-400" /> This is a demonstration terminal with synthetic operational data.</p>
              <p className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0 text-emerald-400" /> New accounts receive read-only access and cannot modify port state.</p>
              <p className="flex gap-2"><Check size={12} className="mt-0.5 shrink-0 text-emerald-400" /> Sessions expire automatically and can be revoked by a supervisor.</p>
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-marine-600 text-[13px] font-semibold text-white shadow-[0_16px_36px_-20px_rgba(37,99,235,0.9)] transition-all hover:bg-marine-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : null}
          {loading ? "Creating account…" : "Create account"}
          {!loading ? <ArrowRight size={14} /> : null}
        </button>
      </form>

      <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-line bg-ink-850/70 px-3 py-2.5">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-cyan-400" />
        <p className="text-[11px] leading-relaxed text-slate-500">
          Passwords are hashed on the server before storage. This form cannot create administrative accounts.
        </p>
      </div>
    </AuthLayout>
  );
}
