import { useState } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import { Eye, EyeOff, LogIn, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import qwikLogo from "../assets/brand/qwik-logo.png";

export default function Login() {
  const { login, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "admin", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={isAdmin ? location.state?.from || "/" : "/staff/dashboard"} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await login(form.username, form.password);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
    } else {
      navigate(location.state?.from || "/", { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-ink bg-gradient-mesh flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute -top-32 -right-20 w-96 h-96 rounded-full bg-brass/20 blur-3xl animate-blob" />
      <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-sky/10 blur-3xl animate-blob" style={{ animationDelay: "2s" }} />
      <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-moss/10 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />

      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white rounded-2xl px-5 py-3 mb-5 shadow-lift">
            <img src={qwikLogo} alt="Qwik Digital and IT Solutions" className="h-11 w-auto" />
          </div>
          <h1 className="font-display font-semibold text-white text-2xl">
            Staff<span className="text-gradient">ClockIn</span>
          </h1>
          <p className="text-ink-300 text-sm mt-1.5 flex items-center gap-1.5">
            <Sparkles size={13} className="text-brass-300" /> Admin control center
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-xl2 shadow-lift p-6 sm:p-7 space-y-4">
          <Input
            label="Username"
            name="username"
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            className="!bg-white/95"
            required
          />
          <div className="relative">
            <Input
              label="Password"
              name="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="!bg-white/95"
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-[34px] text-ink-300 hover:text-ink-500"
              tabIndex={-1}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-rust bg-rust-light rounded-card px-3 py-2">{error}</p>
          )}

          <Button type="submit" variant="accent" className="w-full" icon={LogIn} disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>

          <p className="text-[11px] text-ink-300 text-center pt-1">
            Demo credentials — username <span className="font-mono text-white/80">admin</span>, password <span className="font-mono text-white/80">admin123</span>
          </p>
        </form>

        <p className="text-center text-sm text-ink-300 mt-6">
          Staff member?{" "}
          <Link to="/staff/login" className="text-brass-300 hover:text-brass-200 font-medium">
            Sign in to the Staff Portal
          </Link>
        </p>
      </div>
    </div>
  );
}
