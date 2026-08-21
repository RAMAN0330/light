import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDotDashed,
  FileCheck2,
  GitBranch,
  Orbit,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type LandingPageProps = {
  onStart: () => void;
  onSignOut?: () => void;
};

const capabilities = [
  {
    icon: Search,
    title: "Work from evidence",
    copy: "Keep sources, artifacts, and research attached to the work they inform.",
  },
  {
    icon: ShieldCheck,
    title: "Govern every action",
    copy: "Make approval, policy, and provenance visible before work moves forward.",
  },
  {
    icon: GitBranch,
    title: "Follow work in motion",
    copy: "Move from a request to a durable record without losing the operational context.",
  },
];

export function LandingPage({ onStart, onSignOut }: LandingPageProps) {
  const reduceMotion = useReducedMotion();
  const rise = reduceMotion ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

  return (
    <main className="landing-page">
      <div className="landing-grid" aria-hidden="true" />
      <nav className="landing-nav" aria-label="Main navigation">
        <a className="landing-brand" href="#top" aria-label="Orbital home">
          <span className="landing-brand-mark"><Orbit size={19} strokeWidth={2} /></span>
          <span>Orbital</span>
        </a>
        <div className="landing-nav-links" aria-label="Page sections">
          <a href="#workflow">Workflow</a>
          <a href="#governance">Governance</a>
        </div>
        {onSignOut ? (
          <button className="landing-sign-in" type="button" onClick={onSignOut}>Sign out</button>
        ) : (
          <button className="landing-sign-in" type="button" onClick={onStart}>Sign in</button>
        )}
      </nav>

      <section className="landing-hero" id="top">
        <motion.div className="landing-hero-copy" {...rise} transition={{ duration: 0.55, ease: "easeOut" }}>
          <p className="landing-kicker"><span /> Governed work, in motion</p>
          <h1>AI work with <em>operational memory.</em></h1>
          <p className="landing-lede">Orbital keeps every action, source, approval, and result connected to the workspace that produced it.</p>
          <div className="landing-actions">
            <button className="landing-primary" type="button" onClick={onStart}>
              Get started <ArrowRight size={17} aria-hidden="true" />
            </button>
            <a className="landing-secondary" href="#workflow">See how it works</a>
          </div>
        </motion.div>

        <motion.div
          className="landing-workspace-preview"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96, rotate: 1.5 }}
          animate={reduceMotion ? undefined : { opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.7, delay: reduceMotion ? 0 : 0.1, ease: "easeOut" }}
          aria-label="Example governed Orbital workflow"
        >
          <div className="preview-topbar"><span className="preview-dot" /><span>Northstar workspace</span><span className="preview-live">Live run</span></div>
          <div className="preview-body">
            <aside className="preview-rail"><Orbit size={17} /><span className="preview-rail-active" /><span /><span /><span /></aside>
            <div className="preview-content">
              <div className="preview-heading"><div><span>Research run</span><strong>Vendor risk brief</strong></div><span className="preview-status"><CircleDotDashed size={14} /> Collecting evidence</span></div>
              <div className="preview-run-grid">
                <div className="preview-evidence"><p>Sources <b>04</b></p><div className="preview-source"><Search size={14} /><span>Security policy.pdf</span><CheckCircle2 size={14} /></div><div className="preview-source"><FileCheck2 size={14} /><span>Audit controls.md</span><CheckCircle2 size={14} /></div><div className="preview-source"><Bot size={14} /><span>Assessment notes</span><span className="preview-pulse" /></div></div>
                <div className="preview-approval"><p>Approval gate</p><strong>Review external finding</strong><span>Policy requires an owner before publishing.</span><button type="button">Ready for review</button></div>
              </div>
              <div className="preview-timeline"><span>Run trace</span><div><i /><b>Sources normalized</b><small>2 min ago</small></div><div><i /><b>Finding attached to brief</b><small>Now</small></div></div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="landing-proof" id="workflow">
        <p>One workspace for the work behind the answer.</p>
        <div><span>REQUEST</span><ArrowRight size={15} /><span>EVIDENCE</span><ArrowRight size={15} /><span>APPROVAL</span><ArrowRight size={15} /><span>RECORD</span></div>
      </section>

      <section className="landing-capabilities" id="governance">
        <div className="landing-section-intro"><h2>Built for work that needs to hold up.</h2><p>Orbital gives teams a reliable way to start, inspect, and recover the context behind governed AI work.</p></div>
        <div className="landing-capability-list">
          {capabilities.map(({ icon: Icon, title, copy }, index) => (
            <motion.article key={title} className="landing-capability" initial={reduceMotion ? false : { opacity: 0, y: 16 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.4, delay: index * 0.08 }}>
              <span className="landing-capability-icon"><Icon size={21} /></span>
              <h3>{title}</h3><p>{copy}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="landing-close">
        <Sparkles size={24} aria-hidden="true" />
        <h2>Bring your AI work into the open.</h2>
        <button className="landing-primary" type="button" onClick={onStart}>Get started <ArrowRight size={17} aria-hidden="true" /></button>
      </section>
    </main>
  );
}
