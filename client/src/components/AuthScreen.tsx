import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { Button } from "./ui/button";
import { Input } from "./ui/field";
import { fadeUp, staggerChildren } from "../lib/motion";

export function AuthScreen() {
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

  return <main className="auth-page">
    <section className="auth-intro" aria-hidden="true">
      <div className="brand-mark">O</div>
      <div className="auth-intro-copy">
        <p className="brand-name">Orbital</p>
        <h1>Governed work, in one workspace.</h1>
        <p>Automations, research, analysis, and codebase work — every run attributable to a workspace, an actor, and a policy decision.</p>
      </div>
      <p className="auth-footnote">Built for teams that must show their work.</p>
    </section>
    <section className="auth-card-wrap">
      <motion.div className="auth-card" initial="hidden" animate="show" variants={staggerChildren(0.06)}>
        <motion.div className="auth-mobile-brand" variants={fadeUp}><span className="brand-mark">O</span><span>Orbital</span></motion.div>
        <motion.div className="auth-heading" variants={fadeUp}><h2>Welcome back</h2><p>Sign in to reach your workspace.</p></motion.div>
        {error && <p className="error" role="alert">{error}</p>}
        <motion.form variants={fadeUp} onSubmit={(event) => { event.preventDefault(); void submit("signin"); }}>
          <label>Email<Input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          <label>Password<Input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" /></label>
          <Button type="submit" variant="primary" className="primary-action" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</Button>
        </motion.form>
        <motion.div variants={fadeUp}>
          <Button type="button" variant="secondary" className="primary-action" disabled={submitting} onClick={() => void signInWithSso()}>Continue with SSO</Button>
        </motion.div>
        <motion.p className="auth-switch" variants={fadeUp}>New here? <Button variant="ghost" className="text-button" type="button" disabled={submitting} onClick={() => void submit("signup")}>Create an account</Button></motion.p>
      </motion.div>
    </section>
  </main>;
}
