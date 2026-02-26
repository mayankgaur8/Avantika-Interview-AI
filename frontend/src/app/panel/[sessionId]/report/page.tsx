'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { panelApi } from '@/lib/api';

interface SectionScore { section: string; score: number; maxScore: number; percentage: number }
interface QuestionBreakdown {
  questionText: string; phase: string; askedBy: string;
  score: number; maxScore: number; feedback: string; whereYouWentWrong?: string;
}
interface FinalReport {
  candidateProfile: { track: string; experienceYears: string; role: string; difficulty: string };
  overallScore: number;
  sectionScores: SectionScore[];
  questionBreakdown: QuestionBreakdown[];
  strengths: string[];
  weakAreas: string[];
  mistakesSummary: string[];
  interviewTips: string[];
  focusAreas: string[];
  improvementPlan: string;
  passed: boolean;
}
interface PanelReportResponse {
  session: { track: string; role: string; difficulty: string; phase: string };
  finalReport: FinalReport | null;
}

const PHASE_LABELS: Record<string, string> = {
  warmup: 'Warm-up', core: 'Core', coding: 'Coding', query: 'Query',
};

const PANELIST_CONFIG: Record<string, { icon: string; color: string }> = {
  'Panelist A': { icon: '🧑‍💼', color: 'text-indigo-300' },
  'Panelist B': { icon: '💻', color: 'text-green-300' },
  'Panelist C': { icon: '🗃️', color: 'text-orange-300' },
};

export default function PanelReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [report, setReport] = useState<FinalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'plan'>('overview');

  useEffect(() => {
    let active = true;
    const fetch = async () => {
      try {
        const { data } = await panelApi.getReport(sessionId);
        const resp = data as PanelReportResponse;
        if (!active) return;
        if (resp.finalReport) {
          setReport(resp.finalReport);
          setLoading(false);
        } else if (resp.session.phase !== 'report') {
          router.push(`/panel/${sessionId}`);
        }
      } catch {
        if (active) setLoading(false);
      }
    };
    void fetch();
    return () => { active = false; };
  }, [sessionId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-lg font-medium">Panelists are finalizing your report...</p>
        <p className="text-sm text-slate-400">GPT-4o is analysing your answers</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <p className="text-xl">Report not available</p>
        <Link href="/dashboard" className="text-indigo-400 hover:underline">← Dashboard</Link>
      </div>
    );
  }

  const scoreColor = report.overallScore >= 70 ? 'text-green-400' : report.overallScore >= 50 ? 'text-yellow-400' : 'text-red-400';
  const scoreBorder = report.overallScore >= 70 ? 'border-green-600/50 bg-green-900/15' : report.overallScore >= 50 ? 'border-yellow-600/50 bg-yellow-900/15' : 'border-red-600/50 bg-red-900/15';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900 px-8 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white transition">← Dashboard</Link>
        <span className="text-sm font-semibold">🎙️ Panel Interview · Final Report</span>
        <button
          onClick={() => router.push('/panel/setup')}
          className="text-sm text-indigo-400 hover:text-indigo-300 transition"
        >
          New Interview →
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Summary hero */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-extrabold mb-2">
                {report.candidateProfile.track} · {report.candidateProfile.role}
              </h1>
              <p className="text-slate-400 text-sm">
                {report.candidateProfile.difficulty} difficulty · {report.candidateProfile.experienceYears} years experience
              </p>
              <div className="flex gap-3 mt-4">
                {[
                  { label: 'Panelist A', sub: 'Technical Lead' },
                  { label: 'Panelist B', sub: 'Coding' },
                  { label: 'Panelist C', sub: 'SQL/Query' },
                ].map((p) => {
                  const cfg = PANELIST_CONFIG[p.label];
                  return (
                    <div key={p.label} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span>{cfg?.icon}</span><span className={cfg?.color}>{p.sub}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={`text-center px-8 py-4 rounded-2xl border ${scoreBorder}`}>
              <div className={`text-5xl font-black ${scoreColor}`}>{report.overallScore}</div>
              <div className="text-xs text-slate-400 mt-1">/ 100</div>
              <div className={`text-sm font-bold mt-2 ${report.passed ? 'text-green-300' : 'text-red-300'}`}>
                {report.passed ? '✅ PASSED' : '❌ DID NOT PASS'}
              </div>
            </div>
          </div>

          {/* Section scores */}
          {report.sectionScores.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
              {report.sectionScores.map((s) => (
                <div key={s.section} className="text-center">
                  <div className={`text-2xl font-bold ${s.percentage >= 70 ? 'text-green-400' : s.percentage >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {s.percentage}%
                  </div>
                  <div className="text-xs text-slate-400 capitalize mt-0.5">
                    {PHASE_LABELS[s.section] ?? s.section}
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.percentage >= 70 ? 'bg-green-500' : s.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${s.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {([
            { key: 'overview', label: '📋 Overview' },
            { key: 'questions', label: '🔍 Question Breakdown' },
            { key: 'plan', label: '🗓️ Improvement Plan' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === tab.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="bg-green-900/10 border border-green-700/30 rounded-2xl p-6">
              <h2 className="font-semibold text-green-300 mb-4 flex items-center gap-2">
                <span>✅</span> Strengths
              </h2>
              <ul className="space-y-2">
                {report.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-green-500 mt-0.5">•</span>{s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Weak Areas */}
            <div className="bg-red-900/10 border border-red-700/30 rounded-2xl p-6">
              <h2 className="font-semibold text-red-300 mb-4 flex items-center gap-2">
                <span>⚠️</span> Weak Areas
              </h2>
              <ul className="space-y-2">
                {report.weakAreas.map((s, i) => (
                  <li key={i} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-red-500 mt-0.5">•</span>{s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Mistakes Summary */}
            {report.mistakesSummary.length > 0 && (
              <div className="sm:col-span-2 bg-amber-900/10 border border-amber-700/30 rounded-2xl p-6">
                <h2 className="font-semibold text-amber-300 mb-4 flex items-center gap-2">
                  <span>🔎</span> Where You Went Wrong
                </h2>
                <ul className="space-y-2">
                  {report.mistakesSummary.map((s, i) => (
                    <li key={i} className="text-sm text-slate-300 flex gap-2">
                      <span className="text-amber-500 mt-0.5 shrink-0">→</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Interview Tips */}
            <div className="sm:col-span-2 bg-indigo-900/10 border border-indigo-700/30 rounded-2xl p-6">
              <h2 className="font-semibold text-indigo-300 mb-4 flex items-center gap-2">
                <span>💡</span> How to Answer Better in Real Interviews
              </h2>
              <ul className="space-y-2">
                {report.interviewTips.map((tip, i) => (
                  <li key={i} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-indigo-400 font-bold shrink-0">{i + 1}.</span>{tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tab: Question Breakdown */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {report.questionBreakdown.map((qb, i) => {
              const cfg = PANELIST_CONFIG[qb.askedBy];
              const pct = Math.round((qb.score / qb.maxScore) * 100);
              return (
                <details key={i} className="bg-white/5 border border-white/10 rounded-xl group">
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg shrink-0">{cfg?.icon ?? '🎙️'}</span>
                      <div className="min-w-0">
                        <div className={`text-xs font-medium ${cfg?.color ?? 'text-slate-300'}`}>
                          {qb.askedBy} · {PHASE_LABELS[qb.phase] ?? qb.phase}
                        </div>
                        <div className="text-sm text-slate-300 line-clamp-1">{qb.questionText}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-bold ${pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {qb.score}/{qb.maxScore}
                      </span>
                      <span className="text-slate-500 text-xs group-open:rotate-180 transition-transform">▼</span>
                    </div>
                  </summary>
                  <div className="px-5 pb-5 pt-2 border-t border-white/5 space-y-3">
                    <p className="text-sm text-slate-300 font-medium">Question:</p>
                    <p className="text-sm text-slate-400">{qb.questionText}</p>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-sm text-slate-300 font-medium">Panel Feedback:</p>
                    <p className="text-sm text-slate-400">{qb.feedback}</p>
                    {qb.whereYouWentWrong && (
                      <>
                        <p className="text-sm font-medium text-amber-400">⚠️ Where you went wrong:</p>
                        <p className="text-sm text-slate-400">{qb.whereYouWentWrong}</p>
                      </>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {/* Tab: Improvement Plan */}
        {activeTab === 'plan' && (
          <div className="space-y-6">
            {/* 2-week focus plan */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="font-semibold mb-5 flex items-center gap-2">
                <span>📅</span> Focus Areas — Next 2 Weeks
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {report.focusAreas.map((area, i) => (
                  <div key={i} className="flex items-start gap-3 bg-indigo-900/20 border border-indigo-700/30 rounded-xl px-4 py-3">
                    <span className="text-indigo-400 font-bold text-sm shrink-0">W{Math.floor(i / 3) + 1}</span>
                    <span className="text-sm text-slate-300">{area}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Improvement plan */}
            {report.improvementPlan && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <span>🗺️</span> Personalised Improvement Plan
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {report.improvementPlan}
                </p>
              </div>
            )}

            {/* Tips recap */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <span>🏆</span> Interview Tips Recap
              </h2>
              <ol className="space-y-3">
                {report.interviewTips.map((tip, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-300">
                    <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                    {tip}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex justify-center gap-4 pt-4">
          <Link
            href="/panel/setup"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3 rounded-xl transition"
          >
            🔄 Practice Again →
          </Link>
          <Link
            href="/dashboard"
            className="border border-white/20 hover:border-white/40 text-slate-300 font-semibold px-8 py-3 rounded-xl transition"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
