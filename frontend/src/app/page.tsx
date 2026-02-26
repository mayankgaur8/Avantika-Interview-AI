import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <Logo size={38} />
        <nav className="flex items-center gap-4">
          <Link
            href="/pricing"
            className="text-sm text-slate-300 hover:text-white transition"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-sm text-slate-300 hover:text-white transition"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium transition"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-900/50 border border-indigo-700/50 rounded-full px-4 py-1.5 text-sm text-indigo-300 mb-6">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          AI-Powered Technical Interviews
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent">
          Hire Smarter with
          <br />
          Adaptive AI Interviews
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
          MCQ, coding challenges, behavioral, and system design — all in one
          platform. Real-time evaluation with integrity monitoring and instant
          recruiter reports.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/register"
            className="bg-indigo-600 hover:bg-indigo-500 px-8 py-3.5 rounded-xl font-semibold text-base transition shadow-lg shadow-indigo-900/50"
          >
            Start as Candidate →
          </Link>
          <Link
            href="/register?role=recruiter"
            className="bg-white/10 hover:bg-white/20 border border-white/20 px-8 py-3.5 rounded-xl font-semibold text-base transition"
          >
            Recruiter Dashboard
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-8 py-16 grid md:grid-cols-3 gap-6">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.08] transition"
          >
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-white mb-2">{f.title}</h3>
            <p className="text-sm text-slate-400">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Interview Tracks */}
      <section className="max-w-5xl mx-auto px-8 py-10">
        <h2 className="text-2xl font-bold text-center mb-8">
          Supported Interview Tracks
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TRACKS.map((t) => (
            <div
              key={t.label}
              className={`rounded-xl p-4 text-center border ${t.color}`}
            >
              <div className="text-2xl mb-1">{t.icon}</div>
              <div className="font-semibold text-sm">{t.label}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center py-8 text-xs text-slate-600 border-t border-white/5 mt-10">
      © 2026 Avantika Interview AI · Built with Next.js, NestJS, PostgreSQL &amp; GPT-4o
      </footer>
    </main>
  );
}

const FEATURES = [
  {
    icon: "🧠",
    title: "Adaptive Questioning",
    desc: "Questions dynamically adjust in difficulty based on real-time performance scoring.",
  },
  {
    icon: "🔒",
    title: "Integrity Monitoring",
    desc: "Detects tab switching, copy/paste, DevTools usage, and time anomalies automatically.",
  },
  {
    icon: "📊",
    title: "Instant Recruiter Reports",
    desc: "AI-generated summaries with rubric scores, section breakdowns, and integrity signals.",
  },
  {
    icon: "🐳",
    title: "Secure Code Sandbox",
    desc: "Coding answers run in isolated Docker containers with test case validation.",
  },
  {
    icon: "⚡",
    title: "Async Evaluation",
    desc: "Redis-backed BullMQ workers evaluate answers in background without blocking candidates.",
  },
  {
    icon: "🗂️",
    title: "Role Templates",
    desc: "Pre-built templates for Java, React, Kafka, SQL, System Design and more.",
  },
];

const TRACKS = [
  {
    icon: "📝",
    label: "MCQ",
    color: "border-blue-700/50 bg-blue-900/20 text-blue-300",
  },
  {
    icon: "💻",
    label: "Coding",
    color: "border-green-700/50 bg-green-900/20 text-green-300",
  },
  {
    icon: "🗣️",
    label: "Behavioral",
    color: "border-purple-700/50 bg-purple-900/20 text-purple-300",
  },
  {
    icon: "🏗️",
    label: "System Design",
    color: "border-orange-700/50 bg-orange-900/20 text-orange-300",
  },
  {
    icon: "☕",
    label: "Java",
    color: "border-red-700/50 bg-red-900/20 text-red-300",
  },
  {
    icon: "⚛️",
    label: "React",
    color: "border-cyan-700/50 bg-cyan-900/20 text-cyan-300",
  },
  {
    icon: "📨",
    label: "Kafka",
    color: "border-yellow-700/50 bg-yellow-900/20 text-yellow-300",
  },
  {
    icon: "🗄️",
    label: "SQL",
    color: "border-indigo-700/50 bg-indigo-900/20 text-indigo-300",
  },
];
