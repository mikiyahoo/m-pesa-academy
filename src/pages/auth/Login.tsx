import { ArrowLeft, Building2, Eye, EyeOff, Info, KeyRound, Loader2, Lock, Mail, MessageSquareText, UserPlus, X } from "lucide-react";
import { isInternalEmail } from "../../admin/requests";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  adminUser,
  currentUser,
  DEMO_PASSWORD,
  departmentAdminUser,
  requesterUser,
  trainerUser,
} from "../../data/trainings";
import { useAuth } from "../../store/Auth";
import { AuthShell } from "./AuthShell";

const DEMO_HINT_KEY = "mpesa-learning:demo-hint";

export function Login() {
  const { login, loginWithCode, notice } = useAuth();
  const [params, setParams] = useSearchParams();
  // Arrived from an assessment QR code.
  const returnTo = sessionStorage.getItem("mpesa-learning:return-to") ?? "";
  const path = useLocation().pathname;
  const fromFeedback = path.startsWith("/give-feedback/") || returnTo.startsWith("/give-feedback/");
  const fromAssessment = fromFeedback || path.startsWith("/assess/") || returnTo.startsWith("/assess/");
  // Guests and external trainees sign in with a code to their phone instead of a password.
  const codeMode = params.get("mode") === "code";
  const setCodeMode = (on: boolean) => {
    setError(null);
    setParams(on ? { mode: "code" } : {}, { replace: true });
  };
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  // Demo accounts start collapsed; opening them is remembered per browser (storage failures ignored).
  const [showDemo, setShowDemo] = useState(() => {
    try {
      return localStorage.getItem(DEMO_HINT_KEY) === "shown";
    } catch {
      return false;
    }
  });
  const toggleDemo = (open: boolean) => {
    setShowDemo(open);
    try {
      localStorage.setItem(DEMO_HINT_KEY, open ? "shown" : "hidden");
    } catch {
      // Convenience only.
    }
  };
  const [remember, setRemember] = useState(true);
  // Company emails (@safaricom.et, @mpesa.et) sign in with the organisation account instead.
  const isCompany = !codeMode && isInternalEmail(identifier);
  const [orgStep, setOrgStep] = useState(false);
  const [orgPassword, setOrgPassword] = useState("");
  const [showOrgHint, setShowOrgHint] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isCompany) {
      setOrgPassword("");
      setShowOrgHint(true);
      setOrgStep(true);
      return;
    }
    if (!identifier.trim() || (!codeMode && !password)) {
      setError(codeMode ? "Enter the email or phone number you signed up with." : "Enter your email or phone number and password.");
      return;
    }
    setLoading(true);
    // Simulated network latency.
    setTimeout(() => {
      setError(codeMode ? loginWithCode(identifier) : login(identifier, password));
      setLoading(false);
    }, 700);
  };

  const orgSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!orgPassword) {
      setError("Enter your organisation password.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setError(login(identifier, orgPassword));
      setLoading(false);
    }, 700);
  };

  // Organisation sign-in, like the company's Microsoft account page.
  if (orgStep)
    return (
      <AuthShell>
        {showOrgHint && (
          <div className="fixed top-4 right-4 left-4 z-50 mx-auto max-w-sm rounded-2xl bg-zinc-900/95 p-4 text-white shadow-2xl sm:left-auto">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600">
                <KeyRound className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white">Demo · organisation sign-in</p>
                <p className="mt-0.5 text-sm">
                  For testing, use <b>{identifier.trim().toLowerCase()}</b> with password <b className="tracking-wide">{DEMO_PASSWORD}</b>.
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-white/50">In production this is your Safaricom (Microsoft) account.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setOrgPassword(DEMO_PASSWORD);
                      setShowOrgHint(false);
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100"
                  >
                    Fill in
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => setShowOrgHint(false)} className="text-xs text-white/60 hover:text-white">
                Dismiss
              </button>
            </div>
          </div>
        )}

        <button type="button" onClick={() => (setOrgStep(false), setError(null))} className="mb-8 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800">
          <ArrowLeft className="size-4" /> Back
        </button>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-mpesa-600 text-sm font-bold text-white">S</span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-zinc-900">Safaricom Ethiopia</span>
              <span className="block text-xs text-zinc-500">Organisation account</span>
            </span>
          </div>
          <h2 className="mt-6 text-xl font-bold tracking-tight text-zinc-900">Sign in to your organisation account</h2>
          <p className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">
            <Building2 className="size-3.5 shrink-0 text-zinc-500" /> <span className="truncate">{identifier.trim().toLowerCase()}</span>
          </p>
          <form onSubmit={orgSubmit} className="mt-5 space-y-4" noValidate>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Password</span>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
                <input
                  autoFocus
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={orgPassword}
                  onChange={(e) => setOrgPassword(e.target.value)}
                  placeholder="Your organisation password"
                  className="w-full rounded-xl border border-zinc-200 py-2.5 pr-10 pl-9 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-600" aria-label={show ? "Hide password" : "Show password"}>
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
            {error && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</p>}
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-70">
              {loading && <Loader2 className="size-4 animate-spin" />} Sign in
            </button>
          </form>
          <p className="mt-4 text-xs text-zinc-500">Use the same password as your Safaricom computer and email.</p>
        </div>
      </AuthShell>
    );

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold tracking-tight">{codeMode ? "Sign in with a code" : "Welcome back"}</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {codeMode ? "We’ll email you a 6-digit code." : "Sign in to continue to M-PESA Academy."}
      </p>
      {fromAssessment && !notice && (
        <p className="mt-4 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Sign in to {fromFeedback ? "give your feedback" : "take your assessment"}. We’ll check your training progress and open it for you.
        </p>
      )}
      {notice && (
        <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-900">
          {notice}
        </p>
      )}

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">
            Email or phone number
          </span>
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@mpesa.et"
              className="w-full rounded-xl border border-zinc-200 py-2.5 pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </label>

        {isCompany && (
          <p className="flex items-start gap-2 rounded-xl bg-mpesa-500/10 px-3 py-2.5 text-sm text-mpesa-800">
            <Building2 className="mt-0.5 size-4 shrink-0" /> Company account: you’ll sign in with your Safaricom account.
          </p>
        )}

        {!codeMode && !isCompany && (
        <label className="block">
          <span className="flex items-center justify-between text-sm font-medium text-zinc-700">
            Password
            <button
              type="button"
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              Forgot password?
            </button>
          </span>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-zinc-200 py-2.5 pr-10 pl-9 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-600"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </label>
        )}

        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 accent-brand-600"
          />
          Remember this device
        </label>

        {error && (
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
            {error}
          </p>
        )}

        <button
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-70"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {codeMode ? "Send code" : isCompany ? "Continue with Safaricom account" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setCodeMode(!codeMode)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
      >
        {codeMode ? <Lock className="size-4" /> : <MessageSquareText className="size-4" />}
        {codeMode ? "Staff sign-in with password" : "No password? Sign in with a code"}
      </button>

      <p className="mt-6 text-center text-sm text-zinc-500">
        New to M-PESA Academy?{" "}
        <Link to="/signup" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">
          <UserPlus className="size-3.5" /> Self-register
        </Link>
      </p>

      {!showDemo ? (
        <button
          type="button"
          onClick={() => toggleDemo(true)}
          className="mt-8 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800"
        >
          <Info className="size-3.5" /> Show demo accounts
        </button>
      ) : (
        <div className="mt-8 flex gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-600">
          <Info className="mt-0.5 size-4 shrink-0 text-zinc-400" />
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-zinc-700">
                Demo accounts · password {DEMO_PASSWORD}
              </p>
              <button
                type="button"
                onClick={() => toggleDemo(false)}
                aria-label="Close demo accounts"
                className="-mt-1 -mr-1 rounded-full p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {[
              ["Learner", currentUser.email],
              ["Admin", adminUser.email],
              ["Trainer", trainerUser.email],
              ["Dept admin", departmentAdminUser.email],
              ["Requester", requesterUser.email],
            ].map(([label, email]) => (
              <div
                key={label}
                className="mt-1.5 flex items-center justify-between gap-2"
              >
                <span>
                  <span className="font-medium text-zinc-700">{label}:</span>{" "}
                  {email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier(email);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className="shrink-0 font-medium text-brand-600 hover:underline"
                >
                  Use
                </button>
              </div>
            ))}
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span>
                <span className="font-medium text-zinc-700">
                  Temporary trainee:
                </span>{" "}
                invite link, no password
              </span>
              <Link
                to="/accept/demo-invite"
                className="shrink-0 font-medium text-brand-600 hover:underline"
              >
                Open
              </Link>
            </div>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
