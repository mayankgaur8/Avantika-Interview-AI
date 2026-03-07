'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { interviewsApi, panelApi } from '@/lib/api';
import { getPlanLimits, UPGRADE_MESSAGES } from '@/lib/planConfig';
import { UpgradeModal } from '@/components/UpgradeModal';

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
  createdAt?: string;
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

function getThisMonthCount(sessions: Session[]): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return sessions.filter((s) => {
    const created = s.createdAt ? new Date(s.createdAt) : null;
    return created && created >= startOfMonth;
  }).length;
}

export default function DashboardPage() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [panelSessions, setPanelSessions] = useState<PanelSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradeModal, setUpgradeModal] = useState<{ feature: string; message: string } | null>(null);

  const planLimits = getPlanLimits(user?.plan);

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
    const monthCount = getThisMonthCount(sessions);
    if (monthCount >= planLimits.interviewsPerMonth) {
      setUpgradeModal({
        feature: 'Monthly Interview Limit Reached',
        message: `You've used all ${planLimits.interviewsPerMonth} interviews for this month on the ${user?.plan ?? 'Free'} plan. Upgrade to get more.`,
      });
      return;
    }
    try {
      const { data } = await interviewsApi.startSession(templateId);
      router.push(`/interview/${data.id}`);
    } catch {
      toast.error('Failed to start interview');
    }
  };

  const handlePanelClick = () => {
    if (!planLimits.panelInterview) {
      setUpgradeModal({
        feature: 'AI Panel Interview',
        message: UPGRADE_MESSAGES.panelInterview ?? 'Panel interviews require a Pro or Enterprise plan.',
      });
      return;
    }
    router.push('/panel/setup');
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

  const monthCount = getThisMonthCount(sessions);
  const monthLimit = planLimits.interviewsPerMonth;
  const isUnlimited = monthLimit === Infinity;
  const usagePercent = isUnlimited ? 0 : Math.min(100, (monthCount / monthLimit) * 100);

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
          <div className="text-xs font-medium text-slate-300 capitalize mb-1">{user?.role}</div>
          <div className="mb-3">
            {user?.plan === 'pro' && (
              <span className="text-xs bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-medium">⚡ Pro</span>
            )}
            {user?.plan === 'enterprise' && (
              <span className="text-xs bg-orange-600/30 text-orange-300 border border-orange-500/40 px-2 py-0.5 rounded-full font-medium">🏢 Enterprise</span>
            )}
            {(!user?.plan || user.plan === 'free') && (
              <span className="text-xs bg-slate-700/50 text-slate-400 border border-slate-600/40 px-2 py-0.5 rounded-full font-medium">Free</span>
            )}
          </div>
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
              <span className="text-sm text-slate-400 ml-2">— Upgrade to unlock panel interviews, all tracks, voice, coding sandbox and more.</span>
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

        {/* Monthly usage bar (Free & Pro) */}
        {!isUnlimited && (
          <div className="mb-8 bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300">Interviews this month</span>
              <span className={`text-sm font-bold ${monthCount >= monthLimit ? 'text-red-400' : 'text-white'}`}>
                {monthCount} / {monthLimit}
              </span>
            </div>
            <div className="w-full bg-slate-700/50 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${usagePercent >= 100 ? 'bg-red-500' : usagePercent >= 75 ? 'bg-yellow-500' : 'bg-indigo-500'}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            {monthCount >= monthLimit && (
              <p className="text-xs text-red-400 mt-2">
                Limit reached.{' '}
                <Link href="/dashboard/upgrade" className="underline hover:text-red-300">Upgrade your plan</Link>
                {' '}to start more interviews.
              </p>
            )}
          </div>
        )}

        {/* Panel Interview CTA */}
        <section className="mb-10">
          <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-600/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold">🎙️ AI Panel Interview</h2>
                {!planLimits.panelInterview && (
                  <span className="text-xs bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-semibold">
                    ⚡ Pro
                  </span>
                )}
              </div>
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
            <button
              onClick={handlePanelClick}
              className={`shrink-0 font-semibold px-6 py-3 rounded-xl transition whitespace-nowrap ${
                planLimits.panelInterview
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-white/10 border border-white/20 text-slate-300 hover:bg-white/15'
              }`}
            >
              {planLimits.panelInterview ? 'Start Panel Interview →' : '🔒 Upgrade to Unlock'}
            </button>
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
              {templates.map((t) => {
                const atLimit = !isUnlimited && monthCount >= monthLimit;
                return (
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
                      disabled={atLimit}
                      className={`mt-auto w-full text-sm font-medium py-2 rounded-lg transition ${
                        atLimit
                          ? 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/10'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {atLimit ? '🔒 Limit reached — Upgrade' : 'Start Interview →'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Sessions */}
        <section id="reports">
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

      {/* Upgrade Modal */}
      {upgradeModal && (
        <UpgradeModal
          isOpen={true}
          onClose={() => setUpgradeModal(null)}
          featureName={upgradeModal.feature}
          message={upgradeModal.message}
          requiredPlan="pro"
        />
      )}
    </div>
  );
}
