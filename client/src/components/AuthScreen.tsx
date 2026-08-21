import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, LockKeyhole, Orbit, Sparkles, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Button } from "./ui/button";
import { Input } from "./ui/field";
import { fadeUp, staggerChildren } from "../lib/motion";

export function AuthScreen({ onClose }: { onClose?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(mode: "signin" | "signup") {
    if (submitting) return;
    setSubmitting(true);
    const result = mode === "signin" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    setError(result.error?.message || (mode === "signup" ? "Check your email to confirm your account." : ""));
    setSubmitting(false);
  }

  async function signInWithSso() {
    const domain = email.trim().split("@")[1];
    if (!domain) { setError("Enter your work email to continue with SSO."); return; }
    setSubmitting(true);
    const result = await supabase.auth.signInWithSSO({ domain });
    setError(result.error?.message || "");
    setSubmitting(false);
  }

  return <div className="auth-overlay" role="presentation" onMouseDown={(event) => { if (onClose && event.target === event.currentTarget) onClose(); }}>
    <motion.section className="auth-modal auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title" initial="hidden" animate="show" variants={staggerChildren(0.06)}>
      {onClose && <button className="auth-close" type="button" aria-label="Close sign in" onClick={onClose}><X size={18} /></button>}
        <motion.div className="auth-mobile-brand" variants={fadeUp}><span className="auth-orbit-mark"><Orbit size={19} /><Sparkles size={10} /></span><span>Orbital</span></motion.div>
        <motion.div className="auth-heading" variants={fadeUp}>
          <span className="auth-security"><LockKeyhole size={13} /> Secure workspace</span>
          <h2 id="auth-title">Welcome back</h2><p>Sign in to continue where your team left off.</p>
        </motion.div>
        {error && <p className="error" role="alert">{error}</p>}
        <motion.form variants={fadeUp} onSubmit={(event) => { event.preventDefault(); void submit("signin"); }}>
          <label>Email<Input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          <label>Password<Input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" /></label>
          <Button type="submit" variant="primary" className="primary-action" disabled={submitting} rightIcon={!submitting ? <ArrowUpRight size={16} /> : undefined}>{submitting ? "Signing in…" : "Sign in"}</Button>
        </motion.form>
        <motion.div className="auth-divider" variants={fadeUp}><span>or continue with</span></motion.div>
        <motion.div variants={fadeUp}>
          <Button type="button" variant="secondary" className="primary-action auth-sso-action" disabled={submitting} onClick={() => void signInWithSso()}>Continue with SSO</Button>
        </motion.div>
        <motion.p className="auth-switch" variants={fadeUp}>New here? <Button variant="ghost" className="text-button" type="button" disabled={submitting} onClick={() => void submit("signup")}>Create an account</Button></motion.p>
    </motion.section>
  </div>;
}
