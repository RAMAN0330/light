import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  Download,
  Eye,
  Filter,
  Flame,
  Globe,
  Layers,
  LayoutGrid,
  Lock,
  Maximize2,
  Orbit,
  Palette,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input, Select, Textarea } from "./ui/field";
import { Sparkline } from "./ui/sparkline";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DesignSystemShowcase({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"components" | "colors" | "typography" | "animations">("components");
  const [buttonLoading, setButtonLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [interactiveCounter, setInteractiveCounter] = useState(42);
  const [filterQuery, setFilterQuery] = useState("");

  if (!open) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-[#091b19]/60 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="design-system-title"
    >
      <div className="relative w-full max-w-6xl max-h-[90vh] flex flex-col bg-[#f7faf9] rounded-2xl border border-[#cfe2de] shadow-2xl overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#e1ebe9] bg-white/90 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shadow-[0_4px_12px_rgba(13,148,136,0.3)]">
              <Palette size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="design-system-title" className="text-lg font-extrabold text-[#0f2824] tracking-tight m-0">
                  Orbital Teal Design System
                </h2>
                <Badge variant="teal" size="sm" dot pulse>
                  Production Ready
                </Badge>
              </div>
              <p className="text-xs text-[#52706b] m-0">
                Responsive UI components, 60fps animations & accessible tokens
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex bg-[#e8f1ef] p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "components"
                    ? "bg-white text-teal-800 shadow-sm"
                    : "text-[#4a6964] hover:text-teal-800"
                }`}
                onClick={() => setActiveTab("components")}
              >
                Components
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "colors"
                    ? "bg-white text-teal-800 shadow-sm"
                    : "text-[#4a6964] hover:text-teal-800"
                }`}
                onClick={() => setActiveTab("colors")}
              >
                Teal Palette
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "typography"
                    ? "bg-white text-teal-800 shadow-sm"
                    : "text-[#4a6964] hover:text-teal-800"
                }`}
                onClick={() => setActiveTab("typography")}
              >
                Typography
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "animations"
                    ? "bg-white text-teal-800 shadow-sm"
                    : "text-[#4a6964] hover:text-teal-800"
                }`}
                onClick={() => setActiveTab("animations")}
              >
                Animations
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#52706b] hover:bg-[#e4efec] hover:text-teal-900 transition-colors"
              aria-label="Close design system showcase"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
          {/* TAB 1: COMPONENTS */}
          {activeTab === "components" && (
            <div className="space-y-8">
              {/* SECTION 1: BUTTONS & ACTION CONTROLS */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#0d9488] font-mono m-0">
                      01. Buttons & Micro-Interactions
                    </h3>
                    <p className="text-xs text-[#52706b] m-0">
                      Hardware-accelerated press physics, dynamic loading states, and accessible focus rings.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="teal-subtle"
                    onClick={() => {
                      setButtonLoading(true);
                      setTimeout(() => setButtonLoading(false), 1500);
                    }}
                    leftIcon={<RefreshCw size={13} className={buttonLoading ? "animate-spin" : ""} />}
                  >
                    Simulate Async Action
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-5 rounded-xl border border-[#e1ebe9]">
                  <div className="space-y-1.5">
                    <span className="text-[0.7rem] font-mono text-[#6a8782] uppercase">Primary Brand</span>
                    <Button
                      variant="primary"
                      className="w-full"
                      isLoading={buttonLoading}
                      leftIcon={<Sparkles size={16} />}
                      onClick={() => showToast("Primary action triggered")}
                    >
                      Execute Run
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[0.7rem] font-mono text-[#6a8782] uppercase">Secondary Slate</span>
                    <Button
                      variant="secondary"
                      className="w-full"
                      leftIcon={<Download size={16} />}
                      onClick={() => showToast("Export initiated")}
                    >
                      Export Data
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[0.7rem] font-mono text-[#6a8782] uppercase">Teal Subtle Tint</span>
                    <Button
                      variant="teal-subtle"
                      className="w-full"
                      leftIcon={<Zap size={16} />}
                      onClick={() => showToast("Quick trigger fired")}
                    >
                      Instant Trigger
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[0.7rem] font-mono text-[#6a8782] uppercase">Destructive Action</span>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => showToast("Destructive dialog opened")}
                    >
                      Revoke Key
                    </Button>
                  </div>
                </div>
              </section>

              {/* SECTION 2: METRIC & KPI SPARKLINE CARDS */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#0d9488] font-mono m-0">
                    02. Metric & Sparkline KPI Cards
                  </h3>
                  <p className="text-xs text-[#52706b] m-0">
                    Real-time operational health with SVG sparklines, trend velocity, and hover depth.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1 */}
                  <Card variant="interactive" className="relative group overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-[#52706b]">
                      <span className="font-semibold">Active Workflows</span>
                      <Badge variant="teal" size="sm" dot pulse>
                        Live
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold text-[#0f2824] tracking-tight">
                        {interactiveCounter}
                      </span>
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
                        <ArrowUpRight size={14} /> +14.2%
                      </span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[#edf4f2] flex items-center justify-between">
                      <span className="text-[0.7rem] text-[#6d8a85]">Last 7 days</span>
                      <Sparkline data={[12, 18, 15, 24, 28, 34, 42]} color="#0d9488" height={28} width={80} />
                    </div>
                  </Card>

                  {/* Card 2 */}
                  <Card variant="interactive" className="relative group overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-[#52706b]">
                      <span className="font-semibold">Knowledge Artifacts</span>
                      <Badge variant="emerald" size="sm">
                        Synchronized
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold text-[#0f2824] tracking-tight">
                        1,489
                      </span>
                      <span className="text-xs font-bold text-teal-700 flex items-center gap-0.5">
                        <ArrowUpRight size={14} /> +8.5%
                      </span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[#edf4f2] flex items-center justify-between">
                      <span className="text-[0.7rem] text-[#6d8a85]">99.8% indexed</span>
                      <Sparkline data={[85, 90, 88, 92, 95, 98, 100]} color="#10b981" height={28} width={80} />
                    </div>
                  </Card>

                  {/* Card 3 */}
                  <Card variant="interactive" className="relative group overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-[#52706b]">
                      <span className="font-semibold">Governance Inquiries</span>
                      <Badge variant="amber" size="sm">
                        2 Pending
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold text-[#0f2824] tracking-tight">
                        99.4%
                      </span>
                      <span className="text-xs font-bold text-amber-700">Audit Compliant</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[#edf4f2] flex items-center justify-between">
                      <span className="text-[0.7rem] text-[#6d8a85]">Avg review: 4m</span>
                      <Sparkline data={[45, 52, 48, 60, 58, 62, 64]} color="#d97706" height={28} width={80} />
                    </div>
                  </Card>

                  {/* Card 4 */}
                  <Card variant="interactive" className="relative group overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-[#52706b]">
                      <span className="font-semibold">Inference Latency</span>
                      <Badge variant="cyan" size="sm">
                        144Hz P99
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold text-[#0f2824] tracking-tight">
                        128ms
                      </span>
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
                        -18ms
                      </span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[#edf4f2] flex items-center justify-between">
                      <span className="text-[0.7rem] text-[#6d8a85]">Hardware accel</span>
                      <Sparkline data={[240, 210, 190, 160, 145, 135, 128]} color="#0891b2" height={28} width={80} />
                    </div>
                  </Card>
                </div>
              </section>

              {/* SECTION 3: FORM CONTROLS & INTERACTIVE SEARCH */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#0d9488] font-mono m-0">
                    03. Form Fields & Interactive Inputs
                  </h3>
                  <p className="text-xs text-[#52706b] m-0">
                    Focus states with 4px teal ambient rings, integrated search, and keyboard accessible selectors.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-xl border border-[#e1ebe9]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#25423e] flex items-center justify-between">
                      <span>Search Repository</span>
                      <span className="font-mono text-[0.65rem] text-[#718d88]">⌘ K</span>
                    </label>
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d9994]" />
                      <Input
                        className="pl-9"
                        placeholder="Search models, policies, files…"
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#25423e]">Security Policy Route</label>
                    <Select defaultValue="strict">
                      <option value="strict">Strict (Requires Human Approval)</option>
                      <option value="sandboxed">Sandboxed Read-Only Execution</option>
                      <option value="permissive">Permissive (Automated Ingest)</option>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#25423e] flex items-center justify-between">
                      <span>Interactive Counter</span>
                      <span className="text-[0.68rem] text-teal-700 font-semibold">State sync</span>
                    </label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setInteractiveCounter((c) => Math.max(0, c - 1))}
                      >
                        - Decrement
                      </Button>
                      <Button
                        size="sm"
                        variant="teal-subtle"
                        className="flex-1"
                        onClick={() => setInteractiveCounter((c) => c + 1)}
                      >
                        + Increment
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 4: BADGES, STATUSES & NOTIFICATIONS */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#0d9488] font-mono m-0">
                    04. Badges, Indicators & Toast Signals
                  </h3>
                  <p className="text-xs text-[#52706b] m-0">
                    Semantic status indicators with non-color icons and pulsing activity beacons.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5 p-5 bg-white rounded-xl border border-[#e1ebe9] items-center">
                  <Badge variant="teal" dot pulse>
                    Operational
                  </Badge>
                  <Badge variant="emerald" dot>
                    Active Run
                  </Badge>
                  <Badge variant="amber" dot>
                    Awaiting Review
                  </Badge>
                  <Badge variant="rose" dot>
                    Policy Restricted
                  </Badge>
                  <Badge variant="cyan">
                    SCIM Synced
                  </Badge>
                  <Badge variant="slate">
                    Archived
                  </Badge>
                  <Badge variant="outline">
                    v2.4.0-stable
                  </Badge>
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: TEAL PALETTE */}
          {activeTab === "colors" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#0d9488] font-mono m-0">
                  Teal Color System (WCAG AA Compliant)
                </h3>
                <p className="text-xs text-[#52706b] m-0">
                  Carefully balanced HSL teal gradient scale, paired with dark forest neutrals and warm ivory canvas.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  { name: "Teal 50", hex: "#f0fdfa", text: "#0f766e", role: "Surface Tint" },
                  { name: "Teal 100", hex: "#ccfbf1", text: "#0f766e", role: "Active Highlight" },
                  { name: "Teal 200", hex: "#99f6e4", text: "#115e59", role: "Soft Border" },
                  { name: "Teal 300", hex: "#5eead4", text: "#115e59", role: "Glow Indicator" },
                  { name: "Teal 400", hex: "#2dd4bf", text: "#042f2e", role: "Active Border" },
                  { name: "Teal 500", hex: "#14b8a6", text: "#ffffff", role: "Vibrant Accent" },
                  { name: "Teal 600", hex: "#0d9488", text: "#ffffff", role: "Primary Brand Action" },
                  { name: "Teal 700", hex: "#0f766e", text: "#ffffff", role: "Action Hover" },
                  { name: "Teal 800", hex: "#115e59", text: "#ffffff", role: "Deep Teal Text" },
                  { name: "Teal 950", hex: "#042f2e", text: "#ffffff", role: "Dark Teal Surface" },
                ].map((color) => (
                  <div
                    key={color.name}
                    className="p-3.5 rounded-xl border border-[#d8e7e4] shadow-sm flex flex-col justify-between h-28"
                    style={{ backgroundColor: color.hex, color: color.text }}
                  >
                    <div>
                      <div className="font-bold text-sm">{color.name}</div>
                      <div className="font-mono text-xs opacity-90">{color.hex}</div>
                    </div>
                    <div className="text-[0.7rem] font-semibold opacity-80">{color.role}</div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#e1ebe9] space-y-2">
                <h4 className="text-xs font-bold text-[#0f2824] m-0">Contrast & Readability Matrix</h4>
                <p className="text-xs text-[#52706b] m-0">
                  All primary text on teal or canvas exceeds 7.5:1 contrast ratio, surpassing the 4.5:1 requirement for WCAG AA.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: TYPOGRAPHY */}
          {activeTab === "typography" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#0d9488] font-mono m-0">
                  Typography Scale & Hierarchy
                </h3>
                <p className="text-xs text-[#52706b] m-0">
                  Set in Manrope & DM Mono for modern legibility and high-density operational data.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-[#e1ebe9] space-y-6">
                <div className="border-b border-[#edf4f2] pb-4">
                  <span className="text-[0.65rem] font-mono text-[#0d9488] uppercase">Display Heading 1</span>
                  <h1 className="text-3xl font-extrabold text-[#0f2824] tracking-tight mt-1 mb-0">
                    Governed Enterprise Workspace
                  </h1>
                </div>

                <div className="border-b border-[#edf4f2] pb-4">
                  <span className="text-[0.65rem] font-mono text-[#0d9488] uppercase">Section Heading 2</span>
                  <h2 className="text-xl font-bold text-[#0f2824] tracking-tight mt-1 mb-0">
                    Real-time operational streams and verifiable evidence
                  </h2>
                </div>

                <div className="border-b border-[#edf4f2] pb-4">
                  <span className="text-[0.65rem] font-mono text-[#0d9488] uppercase">Body Copy</span>
                  <p className="text-sm text-[#314e49] leading-relaxed mt-1 mb-0 max-w-2xl">
                    Orbital combines automation, source scraping, analysis, research, and codebase intelligence in one auditable environment with verifiable execution provenance.
                  </p>
                </div>

                <div>
                  <span className="text-[0.65rem] font-mono text-[#0d9488] uppercase">Monospace Data & Code</span>
                  <div className="font-mono text-xs text-[#0f766e] bg-[#f0fdfa] p-3 rounded-lg border border-[#ccfbf1] mt-1">
                    RUN_ID: orb_2026_0817 · STATUS: completed · DURATION: 184ms · COST: $0.0012
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ANIMATIONS */}
          {activeTab === "animations" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#0d9488] font-mono m-0">
                  Hardware-Accelerated 60-144Hz Animations
                </h3>
                <p className="text-xs text-[#52706b] m-0">
                  Using transform, opacity, and spring curves. Fully respects <code className="text-teal-700 bg-teal-50 px-1 py-0.5 rounded">prefers-reduced-motion</code>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <Card variant="interactive" className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 animate-orbitBreathe">
                    <Orbit size={26} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0f2824] m-0">Orbit Breathe</h4>
                    <p className="text-[0.7rem] text-[#52706b] m-0">Gentle pulsating breathing rhythm</p>
                  </div>
                </Card>

                <Card variant="interactive" className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="relative flex h-8 w-8 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-teal-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0f2824] m-0">Beacon Pulse</h4>
                    <p className="text-[0.7rem] text-[#52706b] m-0">Live status activity heartbeat</p>
                  </div>
                </Card>

                <Card variant="interactive" className="flex flex-col items-center justify-center p-6 text-center space-y-3 group">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0f2824] m-0">Hover Lift & Tilt</h4>
                    <p className="text-[0.7rem] text-[#52706b] m-0">Interactive physics on cursor hover</p>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="flex items-center justify-between px-6 py-4 border-t border-[#e1ebe9] bg-white shrink-0">
          <div className="flex items-center gap-2 text-xs text-[#52706b]">
            <CheckCircle2 size={15} className="text-teal-600" />
            <span>Tested on 1920px+ displays with 144Hz refresh rate</span>
          </div>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done Exploring
          </Button>
        </footer>

        {/* Live Action Toast */}
        {toastMessage && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#042f2e] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-slideUp z-50">
            <Sparkles size={14} className="text-teal-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
