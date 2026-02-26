'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { panelApi } from '@/lib/api';

const TRACKS = [
  'Java', 'Spring Boot', 'Microservices', 'Kafka', 'React', 'Node.js',
  'Python', 'Django', 'SQL', 'System Design', 'DevOps', 'TypeScript',
  'AWS / Cloud', 'Data Engineering', 'GraphQL',
];

const EXPERIENCE_OPTIONS = ['1+', '3+', '5+', '7+', '10+', '15+'];

const ROLES = [
  'Backend Engineer',
  'Frontend Engineer',
  'Full Stack Engineer',
  'Data Engineer',
  'DevOps / SRE',
  'Software Architect',
];

const PANELISTS = [
  { name: 'Panelist A', role: 'Technical Lead', icon: '🧑‍💼', color: 'border-indigo-500/40 bg-indigo-900/20' },
  { name: 'Panelist B', role: 'Coding Evaluator', icon: '💻', color: 'border-green-500/40 bg-green-900/20' },
  { name: 'Panelist C', role: 'SQL/Query Evaluator', icon: '🗃️', color: 'border-orange-500/40 bg-orange-900/20' },
];

const PHASES = [
  { label: 'Warm-up', count: '2 questions', icon: '☀️' },
  { label: 'Core Technical', count: '5–7 questions (adaptive)', icon: '🧠' },
  { label: 'Coding Round', count: '1 mandatory problem', icon: '⌨️' },
  { label: 'Query Round', count: '1 SQL/query question', icon: '🗄️' },
  { label: 'Final Report', count: 'Scores + improvement plan', icon: '📊' },
];

export default function PanelSetupPage() {
  const router = useRouter();
  const [track, setTrack] = useState('');
  const [experience, setExperience] = useState('');
  const [role, setRole] = useState('');
  const [difficulty, setDifficulty] = useState<'Normal' | 'Hard'>('Normal');
  const [loading, setLoading] = useState(false);

  const canStart = track && experience && role;

  const handleStart = async () => {
    if (!canStart) return;
    setLoading(true);
    try {
      const { data } = await panelApi.createSession({
        track,
        experienceYears: experience,
        targetRole: role,
        difficulty,
      });
      toast.success('Panel session created! Starting warm-up...');
      router.push(`/panel/${data.id as string}`);
    } catch {
      toast.error('Failed to create panel session. Please log in.');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900 px-8 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-slate-400 hover:text-white transition"
        >
          ← Dashboard
        </button>
        <span className="text-white/20">|</span>
        <span className="text-sm font-semibold">🎙️ Panel Interview — Setup</span>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12">
        {/* Left — config form */}
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold mb-2">Configure Your Interview</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Three expert panelists will conduct a structured technical interview
              tailored to your track and experience level.
            </p>
          </div>

          {/* Track */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3">
              Interview Track *
            </label>
            <div className="flex flex-wrap gap-2">
              {TRACKS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTrack(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                    track === t
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/40'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Experience */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3">
              Years of Experience *
            </label>
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => setExperience(e)}
                  className={`px-4 py-2 rounded-lg text-sm border transition ${
                    experience === e
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/40'
                  }`}
                >
                  {e} yrs
                </button>
              ))}
            </div>
          </div>

          {/* Target Role */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3">
              Target Role *
            </label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                    role === r
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/40'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-3">
              Difficulty
            </label>
            <div className="flex gap-3">
              {(['Normal', 'Hard'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-medium border transition ${
                    difficulty === d
                      ? d === 'Hard'
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'bg-green-700 border-green-500 text-white'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/40'
                  }`}
                >
                  {d === 'Hard' ? '🔥 Hard' : '⚡ Normal'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!canStart || loading}
            className="w-full py-4 rounded-2xl text-base font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Creating session...' : '🎙️ Start Panel Interview →'}
          </button>
        </div>

        {/* Right — panel info */}
        <div className="space-y-6">
          {/* Panelists */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Your Interview Panel
            </h2>
            <div className="space-y-3">
              {PANELISTS.map((p) => (
                <div
                  key={p.name}
                  className={`flex items-center gap-4 p-4 rounded-xl border ${p.color}`}
                >
                  <span className="text-2xl">{p.icon}</span>
                  <div>
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interview flow */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Interview Phases
            </h2>
            <div className="space-y-2">
              {PHASES.map((phase, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-lg mt-0.5">{phase.icon}</span>
                  <div>
                    <div className="text-sm font-medium">{phase.label}</div>
                    <div className="text-xs text-slate-400">{phase.count}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rules */}
          <div className="bg-amber-900/15 border border-amber-700/30 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-amber-300 mb-2">📋 Rules</h3>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• One question at a time — wait for feedback before proceeding</li>
              <li>• Follow-up questions may be asked if your answer is incomplete</li>
              <li>• Difficulty adjusts based on your live performance</li>
              <li>• Coding & Query rounds are mandatory and cannot be skipped</li>
              <li>• Score scale: 0–10 per question, 0–100 overall</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
