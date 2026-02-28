'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { interviewsApi, panelApi } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  role: string;
  difficulty: string;
  timeLimitMinutes: number;
  passingScorePercent: number;
  sectionConfig: Record<string, { count: number; weight: number }>;
}

interface Session {
  id: string;
  status: string;
  interviewType: string;
  percentageScore?: number;
  completedAt?: string;
  template?: { name: string; role: string };
  reportUrl?: string;
  isIntegrityFlagged?: boolean;
}

interface PanelSession {
  id: string;
  track: string;
  targetRole: string;
  difficulty: string;
  phase: string;
  status: string;
  createdAt: string;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  junior: 'bg-green-900/30 text-green-300 border-green-700/40',
  mid: 'bg-blue-900/30 text-blue-300 border-blue-700/40',
  senior: 'bg-orange-900/30 text-orange-300 border-orange-700/40',
  staff: 'bg-red-900/30 text-red-300 border-red-700/40',
};

const STATUS_COLOR: Record<string, string> = {
  completed: 'bg-green-900/30 text-green-300',
  in_progress: 'bg-yellow-900/30 text-yellow-300',
  scheduled: 'bg-blue-900/30 text-blue-300',
  abandoned: 'bg-slate-700 text-slate-400',
  flagged: 'bg-red-900/30 text-red-300',
};

export default function DashboardPage() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [panelSessions, setPanelSessions] = useState<PanelSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadData();
  }, [isAuthenticated, router]);

  const loadData = async () => {
    try {
      const [tmpl, sess, panel] = await Promise.all([
        interviewsApi.getTemplates(),
        interviewsApi.getMySessions(),
        panelApi.listSessions(),
      ]);
      setTemplates(tmpl.data);
      setSessions(sess.data);
      setPanelSessions(panel.data as PanelSession[]);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const startInterview = async (templateId: string) => {
    try {
      const { data } = await interviewsApi.startSession(templateId);
      router.push(`/interview/${data.id}`);
    } catch {
      toast.error('Failed to start interview');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-sm animate-pulse">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-56 bg-slate-900 border-r border-white/10 flex flex-col">
        <div className="p-5 border-b border-white/10">
            <Logo size={28} />
          </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { label: '🏠 Dashboard', href: '/dashboard', active: true },
            { label: '📝 My Interviews', href: '/dashboard' },
            { label: '📊 Reports', href: '/dashboard#reports' },
            { label: '⚡ Upgrade Plan', href: '/dashboard/upgrade' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm transition ${item.active ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-slate-500 mb-1">{user?.email}</div>
          <div className="text-xs font-medium text-slate-300 capitalize mb-3">{user?.role}</div>
          <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-400 transition">
            Sign out →
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-56 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">
            Welcome, {user?.firstName} 👋
          </h1>
          <p className="text-slate-400 text-sm">
            {user?.role === 'candidate'
              ? 'Choose an interview track to begin'
              : 'Manage templates and review candidate reports'}
          </p>
        </div>

        {/* Upgrade banner for free users */}
        {(!user?.plan || user.plan === 'free') && (
          <div className="mb-6 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-600/30 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-semibold text-white">You're on the Free plan</span>
              <span className="text-sm text-slate-400 ml-2">— Upgrade to unlock all interview tracks, panel mode, and more.</span>
            </div>
            <Link
              href="/dashboard/upgrade"
              className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              Upgrade →
            </Link>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Sessions Taken', value: sessions.length },
            { label: 'Completed', value: sessions.filter((s) => s.status === 'completed').length },
            {
              label: 'Avg Score',
              value: sessions.filter((s) => s.percentageScore != null).length > 0
                ? `${(sessions.filter((s) => s.percentageScore != null).reduce((a, s) => a + (s.percentageScore ?? 0), 0) / sessions.filter((s) => s.percentageScore != null).length).toFixed(1)}%`
                : '—',
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Panel Interview CTA */}
        <section className="mb-10">
          <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-600/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold mb-1">🎙️ AI Panel Interview</h2>
              <p className="text-sm text-slate-400 max-w-md">
                Simulate a real interview with 3 expert panelists — Technical Lead, Coding Evaluator &amp; SQL Evaluator.
                Get adaptive questions, follow-ups, and a personalised report.
              </p>
              <div className="flex gap-3 mt-3 text-xs text-slate-500">
                <span>☀️ Warm-up</span>
                <span>→</span>
                <span>🧠 Core (5–7q)</span>
                <span>→</span>
                <span>⌨️ Coding</span>
                <span>→</span>
                <span>🗄️ SQL/Query</span>
                <span>→</span>
                <span>📊 Report</span>
              </div>
            </div>
            <Link
              href="/panel/setup"
              className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition whitespace-nowrap"
            >
              Start Panel Interview →
            </Link>
          </div>

          {/* Recent panel sessions */}
          {panelSessions.length > 0 && (
            <div className="mt-4 rounded-xl border border-white/10 overflow-hidden">
              <div className="bg-white/5 px-4 py-2 text-xs text-slate-400 uppercase tracking-wider font-medium">
                Recent Panel Sessions
              </div>
              {panelSessions.slice(0, 3).map((ps) => (
                <div key={ps.id} className="flex items-center justify-between px-4 py-3 border-t border-white/5 hover:bg-white/[0.02] transition">
                  <div>
                    <span className="text-sm font-medium">{ps.track}</span>
                    <span className="text-xs text-slate-500 ml-2">{ps.targetRole} · {ps.difficulty}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${ps.status === 'completed' ? 'bg-green-900/30 text-green-300' : 'bg-yellow-900/30 text-yellow-300'}`}>
                      {ps.phase === 'report' ? 'completed' : ps.phase}
                    </span>
                    {ps.phase === 'report' ? (
                      <Link href={`/panel/${ps.id}/report`} className="text-xs text-green-400 hover:text-green-300">View Report</Link>
                    ) : (
                      <Link href={`/panel/${ps.id}`} className="text-xs text-indigo-400 hover:text-indigo-300">Resume</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Available Templates */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Available Interviews</h2>
          {templates.length === 0 ? (
            <div className="text-slate-500 text-sm">No templates available yet.</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => (
                <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-3 hover:border-indigo-500/50 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-sm">{t.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{t.role}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${DIFFICULTY_COLOR[t.difficulty] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                      {t.difficulty}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>⏱ {t.timeLimitMinutes} min</span>
                    <span>🎯 Pass: {t.passingScorePercent}%</span>
                    {Object.entries(t.sectionConfig).map(([type, cfg]) => (
                      <span key={type} className="capitalize">{type}: {cfg.count}q</span>
                    ))}
                  </div>
                  <button
                    onClick={() => startInterview(t.id)}
                    className="mt-auto w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 rounded-lg transition"
                  >
                    Start Interview →
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Sessions */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Recent Sessions</h2>
          {sessions.length === 0 ? (
            <div className="text-slate-500 text-sm">No sessions yet. Start your first interview!</div>
          ) : (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Interview</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Score</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 font-medium">
                        {s.template?.name ?? 'Unknown'}
                        {s.isIntegrityFlagged && <span className="ml-2 text-red-400 text-xs">🚩 Flagged</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLOR[s.status] ?? 'bg-slate-700 text-slate-400'}`}>
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.percentageScore != null ? `${s.percentageScore.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {s.completedAt ? new Date(s.completedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {s.status === 'in_progress' && (
                          <Link href={`/interview/${s.id}`} className="text-indigo-400 hover:text-indigo-300 text-xs">Resume</Link>
                        )}
                        {s.status === 'completed' && s.reportUrl && (
                          <Link href={`/report/${s.id}`} className="text-green-400 hover:text-green-300 text-xs">View Report</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
