'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { reportsApi } from '@/lib/api';
import Link from 'next/link';

interface SectionBreakdown {
  sectionType: string;
  score: number;
  maxScore: number;
  percentage: number;
  questionCount: number;
  correctCount: number;
}

interface QuestionDetail {
  questionId: string;
  type: string;
  content: string;
  score: number;
  maxScore: number;
  timeTakenSeconds: number;
  feedback: string;
}

interface IntegrityReport {
  flagged: boolean;
  flagCount: number;
  events: Array<{ type: string; severity: string; count: number }>;
  overallRisk: 'low' | 'medium' | 'high';
}

interface ReportSummary {
  candidateName: string;
  role: string;
  difficulty: string;
  totalScore: number;
  maxScore: number;
  percentageScore: number;
  passed: boolean;
  durationMinutes: number;
  completedAt: string;
}

interface Report {
  id: string;
  status: string;
  summary: ReportSummary;
  sectionBreakdown: SectionBreakdown[];
  questionDetails: QuestionDetail[];
  integrityReport: IntegrityReport;
  aiNarrative: string;
  recruiterNotes?: string;
}

const SECTION_ICONS: Record<string, string> = {
  mcq: '📝', coding: '💻', behavioral: '🗣️', system_design: '🏗️',
};

const RISK_CONFIG = {
  low: { color: 'text-green-400', bg: 'bg-green-900/20 border-green-700/50', label: '✅ Low Risk' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/50', label: '⚠️ Medium Risk' },
  high: { color: 'text-red-400', bg: 'bg-red-900/20 border-red-700/50', label: '🚨 High Risk' },
};

export default function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const doFetch = async () => {
      try {
        const { data } = await reportsApi.getReportBySession(sessionId);
        if (!active) return;
        if (data?.status === 'ready') {
          setReport(data);
          setLoading(false);
        } else if (data?.status === 'failed') {
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    };

    void doFetch();
    const interval = setInterval(() => { void doFetch(); }, 3000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (active) setLoading(false);
    }, 120_000);

    return () => {
      active = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-lg font-medium">Generating your report...</p>
        <p className="text-sm text-slate-400">This takes about 15–30 seconds</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <p className="text-xl">Report not available yet</p>
        <Link href="/dashboard" className="text-indigo-400 hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }

  const { summary, sectionBreakdown, questionDetails, integrityReport, aiNarrative } = report;
  const passed = summary.passed;
  const risk = RISK_CONFIG[integrityReport?.overallRisk ?? 'low'];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900 px-8 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white transition flex items-center gap-1">
          ← Dashboard
        </Link>
        <span className="text-sm font-medium">🤖 InterviewAI · Report</span>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* Summary card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">{summary.role} Interview Report</h1>
              <p className="text-slate-400 text-sm">
                {summary.difficulty} · {summary.durationMinutes} min · {new Date(summary.completedAt).toLocaleDateString()}
              </p>
            </div>
            <div className={`text-center px-6 py-3 rounded-xl border ${passed ? 'border-green-600/50 bg-green-900/20' : 'border-red-600/50 bg-red-900/20'}`}>
              <div className={`text-3xl font-extrabold ${passed ? 'text-green-400' : 'text-red-400'}`}>
                {summary.percentageScore.toFixed(1)}%
              </div>
              <div className={`text-xs font-semibold mt-0.5 ${passed ? 'text-green-300' : 'text-red-300'}`}>
                {passed ? '✅ PASSED' : '❌ DID NOT PASS'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {summary.totalScore.toFixed(1)} / {summary.maxScore.toFixed(1)} pts
              </div>
            </div>
          </div>
        </div>

        {/* AI Narrative */}
        {aiNarrative && (
          <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-indigo-300 mb-3 uppercase tracking-wider">AI Assessment</h2>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{aiNarrative}</p>
          </div>
        )}

        {/* Section Breakdown */}
        {sectionBreakdown?.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Section Breakdown</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {sectionBreakdown.map((s) => (
                <div key={s.sectionType} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium capitalize">
                      {SECTION_ICONS[s.sectionType] ?? '📌'} {s.sectionType.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-semibold">{s.percentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.percentage >= 70 ? 'bg-green-500' : s.percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${s.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>{s.score.toFixed(1)} / {s.maxScore.toFixed(1)} pts</span>
                    <span>{s.correctCount}/{s.questionCount} correct</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Integrity */}
        {integrityReport && (
          <div className={`rounded-2xl border p-6 ${risk.bg}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Integrity Report</h2>
              <span className={`text-sm font-semibold ${risk.color}`}>{risk.label}</span>
            </div>
            {integrityReport.events?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {integrityReport.events.map((evt) => (
                  <div key={evt.type} className="bg-white/5 rounded-lg p-3 text-xs">
                    <div className="font-medium capitalize text-slate-300">{evt.type.replace(/_/g, ' ')}</div>
                    <div className="text-slate-500 mt-0.5">×{evt.count} · {evt.severity}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No integrity events recorded. ✅</p>
            )}
          </div>
        )}

        {/* Question-by-question breakdown */}
        {questionDetails?.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Question Breakdown</h2>
            <div className="space-y-3">
              {questionDetails.map((qd, i) => (
                <details key={qd.questionId} className="bg-white/5 border border-white/10 rounded-xl group">
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">Q{i + 1}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
                        qd.type === 'mcq' ? 'border-blue-700/50 bg-blue-900/20 text-blue-300' :
                        qd.type === 'coding' ? 'border-green-700/50 bg-green-900/20 text-green-300' :
                        'border-purple-700/50 bg-purple-900/20 text-purple-300'
                      }`}>{qd.type.replace('_', ' ')}</span>
                      <span className="text-sm text-slate-300 line-clamp-1 max-w-xs">{qd.content}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm shrink-0">
                      <span className={qd.score >= qd.maxScore * 0.7 ? 'text-green-400' : 'text-red-400'}>
                        {qd.score.toFixed(1)}/{qd.maxScore.toFixed(1)}
                      </span>
                      <span className="text-slate-500 text-xs">{qd.timeTakenSeconds}s</span>
                      <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                    </div>
                  </summary>
                  <div className="px-5 pb-4 pt-1 border-t border-white/5">
                    <p className="text-sm text-slate-300 mb-3 font-medium">Question:</p>
                    <p className="text-sm text-slate-400 mb-4 whitespace-pre-wrap">{qd.content}</p>
                    {qd.feedback && (
                      <>
                        <p className="text-sm text-slate-300 mb-2 font-medium">Feedback:</p>
                        <p className="text-sm text-slate-400 whitespace-pre-wrap">{qd.feedback}</p>
                      </>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center pt-4">
          <Link
            href="/dashboard"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3 rounded-xl transition"
          >
            Back to Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}
