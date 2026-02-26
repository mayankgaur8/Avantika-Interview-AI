'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { panelApi } from '@/lib/api';

// ── Speech helpers ─────────────────────────────────────────────────

/** Returns loaded voices, waiting for the voiceschanged event if needed. */
function getVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    const handler = () => {
      resolve(window.speechSynthesis.getVoices());
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
  });
}

/**
 * Pick the best available voice for a given panelist.
 * Priority order — best sounding macOS/Chrome/Windows voices first.
 */
function pickVoice(voices: SpeechSynthesisVoice[], panelist: string): SpeechSynthesisVoice | null {
  const find = (...names: string[]) =>
    names.map((n) => voices.find((v) => v.name.toLowerCase().includes(n.toLowerCase())))
         .find(Boolean) ?? null;

  if (panelist === 'Panelist A') {
    // Deep, calm, authoritative male — Technical Lead
    return (
      find('Daniel', 'Arthur', 'Oliver', 'Liam', 'Tom') ??       // macOS UK/AU male
      find('Google UK English Male') ??                            // Chrome
      find('Microsoft David', 'Microsoft Mark', 'Microsoft James') ?? // Windows
      voices.find((v) => v.lang === 'en-GB') ??
      voices.find((v) => v.lang === 'en-US' && v.name.match(/male|man|david|mark|james|paul/i)) ??
      voices.find((v) => v.lang.startsWith('en')) ?? null
    );
  }

  if (panelist === 'Panelist B') {
    // Warm, clear, friendly male — Coding Evaluator
    return (
      find('Aaron', 'Fred', 'Alex', 'Bruce', 'Reed') ??           // macOS
      find('Google US English Male', 'Google US English') ??       // Chrome
      find('Microsoft Guy', 'Microsoft Alex') ??                   // Windows
      voices.find((v) => v.lang === 'en-US') ??
      voices.find((v) => v.lang.startsWith('en')) ?? null
    );
  }

  if (panelist === 'Panelist C') {
    // Smooth, professional female — SQL/Query Evaluator
    return (
      find('Samantha', 'Karen', 'Moira', 'Serena', 'Tessa') ??    // macOS female
      find('Google UK English Female') ??                          // Chrome
      find('Microsoft Zira', 'Microsoft Hazel', 'Microsoft Susan') ?? // Windows
      voices.find((v) => v.lang === 'en-US' && v.name.match(/female|woman|zira|susan|alice|kate/i)) ??
      voices.find((v) => v.lang.startsWith('en')) ?? null
    );
  }

  return voices.find((v) => v.lang.startsWith('en')) ?? null;
}

/** Voice profile per panelist — tuned for a warm, interview-room feel */
const PANELIST_VOICE_PROFILE: Record<string, { pitch: number; rate: number }> = {
  'Panelist A': { pitch: 0.88, rate: 0.88 }, // Deeper, measured — like a senior tech lead
  'Panelist B': { pitch: 1.00, rate: 0.92 }, // Neutral, clear — friendly coder
  'Panelist C': { pitch: 1.08, rate: 0.85 }, // Slightly higher, calm — professional evaluator
};

/** Speak text via browser TTS with soothing voice selection. */
async function speak(
  text: string,
  panelist?: string,
  overridePitch?: number,
  overrideRate?: number,
): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  await new Promise((r) => setTimeout(r, 150));

  const voices = await getVoicesAsync();
  const profile = panelist
    ? (PANELIST_VOICE_PROFILE[panelist] ?? { pitch: 1.0, rate: 0.90 })
    : { pitch: overridePitch ?? 1.0, rate: overrideRate ?? 0.90 };

  const voice = panelist
    ? pickVoice(voices, panelist)
    : (voices.find((v) => v.lang === 'en-US') ?? voices.find((v) => v.lang.startsWith('en')) ?? null);

  return new Promise((resolve) => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.pitch  = profile.pitch;
    utt.rate   = profile.rate;
    utt.volume = 1;
    if (voice) utt.voice = voice;

    // Chrome silent-stop bug keep-alive
    const keepAlive = setInterval(() => {
      if (!window.speechSynthesis.speaking) { clearInterval(keepAlive); return; }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 10_000);
    utt.onend  = () => { clearInterval(keepAlive); resolve(); };
    utt.onerror = () => { clearInterval(keepAlive); resolve(); };

    window.speechSynthesis.speak(utt);
  });
}

// Keep legacy pitch map for any direct callers (now unused but safe to keep)
const PANELIST_PITCH: Record<string, number> = {
  'Panelist A': 0.88,
  'Panelist B': 1.00,
  'Panelist C': 1.08,
};

// SpeechRecognition type shim
type SpeechRecognitionResult = { isFinal: boolean; [j: number]: { transcript: string } };
type SpeechRecognitionResultList = { length: number; [i: number]: SpeechRecognitionResult };
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

// ── Types ─────────────────────────────────────────────────────────

interface TestCase { input: string; output: string }
interface Editor {
  enabled: boolean;
  languageOptions: string[];
  starterCode: string;
  testCases: TestCase[];
}

interface CurrentQuestion {
  id: string;
  askedBy: string;
  type: 'technical' | 'coding' | 'query';
  questionText: string;
  constraints?: string;
  expectedAnswerFormat: 'text' | 'code' | 'sql';
  editor?: Editor;
  schemaInfo?: string;
  pendingFollowUp: string | null;
}

interface Evaluation {
  score: number;
  feedback: string;
  followUpQuestion: string | null;
}

interface SessionInfo {
  id: string;
  track: string;
  experienceYears: string;
  role: string;
  difficulty: string;
  phase: string;
  questionIndex: number;
  status: string;
}

interface PanelApiResponse {
  session: SessionInfo;
  panel: Array<{ name: string; role: string }>;
  currentQuestion: CurrentQuestion | null;
  evaluation: Evaluation | null;
  finalReport: FinalReport | null;
}

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

// ── Panelist config ───────────────────────────────────────────────

const PANELIST_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  'Panelist A': { icon: '🧑‍💼', color: 'text-indigo-300', bg: 'bg-indigo-900/20 border-indigo-500/30' },
  'Panelist B': { icon: '💻', color: 'text-green-300', bg: 'bg-green-900/20 border-green-500/30' },
  'Panelist C': { icon: '🗃️', color: 'text-orange-300', bg: 'bg-orange-900/20 border-orange-500/30' },
};

const PHASE_LABELS: Record<string, string> = {
  warmup: '☀️ Warm-up',
  core: '🧠 Core Technical',
  coding: '⌨️ Coding Round',
  query: '🗄️ Query Round',
  report: '📊 Final Report',
};

// ── Main Component ────────────────────────────────────────────────

export default function PanelInterviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [response, setResponse] = useState<PanelApiResponse | null>(null);
  const [answer, setAnswer] = useState('');
  const [selectedLang, setSelectedLang] = useState('javascript');
  const [submitting, setSubmitting] = useState(false);
  const [lastEval, setLastEval] = useState<Evaluation | null>(null);
  const [showEval, setShowEval] = useState(false);
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Skip / Exit state ────────────────────────────────────────────
  const [skipping, setSkipping] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [abandoning, setAbandoning] = useState(false);

  // ── Voice state ─────────────────────────────────────────────────
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // ── Score tracking ───────────────────────────────────────────────
  const [scores, setScores] = useState<number[]>([]);   // one per answered question
  const [animScore, setAnimScore] = useState<number | null>(null); // for score pop animation

  // ── Speak a question aloud ───────────────────────────────────────
  const speakQuestion = useCallback(async (q: CurrentQuestion, delayMs = 0) => {
    if (!ttsEnabled) return;
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    const text = q.pendingFollowUp ? `Follow-up question: ${q.pendingFollowUp}` : q.questionText;
    setIsSpeaking(true);
    await speak(text, q.askedBy);
    setIsSpeaking(false);
  }, [ttsEnabled]);

  // ── Start / stop microphone ──────────────────────────────────────
  // Holds the answer text that existed BEFORE the mic session started
  const micBaselineRef = useRef('');

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { toast.error('Speech recognition not supported in this browser'); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    // Snapshot of existing answer when mic starts — we'll append to this
    micBaselineRef.current = '';
    // Read current answer value via a callback to avoid stale closure
    setAnswer((current) => { micBaselineRef.current = current; return current; });

    rec.onresult = (e: SpeechRecognitionEvent) => {
      // Rebuild: all FINAL results + the latest interim result
      let finalText = '';
      let interimText = '';
      const resultCount = e.results.length ?? 0;
      for (let i = 0; i < resultCount; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText = result[0].transcript; // only keep latest interim
        }
      }
      const spoken = (finalText + interimText).trim();
      const base = micBaselineRef.current;
      setAnswer(base + (base && spoken ? ' ' : '') + spoken);
    };
    rec.onerror = () => { setIsListening(false); };
    rec.onend = () => {
      setIsListening(false);
      // Commit: freeze whatever is in the box as the new baseline in case mic restarts
      setAnswer((current) => { micBaselineRef.current = current; return current; });
    };
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // ── Load question on mount ───────────────────────────────────────
  // Load question on mount
  const loadQuestion = useCallback(async () => {
    try {
      const { data } = await panelApi.getCurrentQuestion(sessionId);
      setResponse(data as PanelApiResponse);
      setAnswer('');
      setShowEval(false);
      setIsFollowUpMode(false);

      const q = (data as PanelApiResponse).currentQuestion;
      if (q?.type === 'coding') {
        const lang = q.editor?.languageOptions[0] ?? 'javascript';
        setSelectedLang(lang);
        setAnswer(q.editor?.starterCode ?? '');
      }
      // Auto-speak the new question — delay 600ms on first load so voices are ready
      if (q) void speakQuestion(q, 600);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (msg.includes('complete') || msg.includes('report')) {
        router.push(`/panel/${sessionId}/report`);
      } else {
        toast.error('Failed to load question');
      }
    }
  }, [sessionId, router, speakQuestion]);

  useEffect(() => { void loadQuestion(); }, [loadQuestion]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastEval, response?.currentQuestion]);

  const handleSubmit = async () => {
    if (!answer.trim() || submitting || !response?.currentQuestion) return;
    stopListening();
    setSubmitting(true);

    try {
      const { data } = await panelApi.submitAnswer(sessionId, {
        questionId: response.currentQuestion.id,
        answer: answer.trim(),
        language: response.currentQuestion.type === 'coding' ? selectedLang : undefined,
        isFollowUp: isFollowUpMode,
      });

      const resp = data as PanelApiResponse;
      setLastEval(resp.evaluation);
      setShowEval(true);

      // Record score and animate it
      if (resp.evaluation) {
        const s = resp.evaluation.score;
        setScores((prev) => [...prev, s]);
        setAnimScore(s);
        setTimeout(() => setAnimScore(null), 2500);

        // Speak feedback aloud
        if (ttsEnabled) {
          const label = s >= 7 ? 'Great answer.' : s >= 4 ? 'Fair answer.' : 'Needs more depth.';
          void speak(`${label} Score: ${s} out of 10. ${resp.evaluation.feedback}`);
        }
      }

      if (resp.session.phase === 'report') {
        toast.success('Interview complete! Generating report...');
        if (ttsEnabled) void speak('Well done. The interview is now complete. Generating your final report.');
        setTimeout(() => router.push(`/panel/${sessionId}/report`), 2500);
        return;
      }

      // If follow-up was triggered
      if (resp.evaluation?.followUpQuestion) {
        setIsFollowUpMode(true);
        setResponse(resp);
        setAnswer('');
        // Speak the follow-up question
        if (ttsEnabled) void speak(`Follow-up question: ${resp.evaluation.followUpQuestion}`);
      } else {
        // Auto-advance after showing eval
        setResponse(resp);
        setTimeout(() => {
          setShowEval(false);
          setAnswer('');
          setIsFollowUpMode(false);
          void loadQuestion();
        }, 3500);
      }
    } catch {
      toast.error('Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueAfterEval = () => {
    setShowEval(false);
    setLastEval(null);
    setIsFollowUpMode(false);
    void loadQuestion();
  };

  const handleSkip = async () => {
    if (skipping || submitting) return;
    stopListening();
    window.speechSynthesis?.cancel();
    setSkipping(true);
    try {
      const { data } = await panelApi.skipQuestion(sessionId);
      const resp = data as PanelApiResponse;
      setScores((prev) => [...prev, 0]);
      setAnimScore(0);
      setTimeout(() => setAnimScore(null), 2000);
      toast('Question skipped.', { icon: '⏭️' });
      if (ttsEnabled) void speak('Question skipped. Moving to the next question.');
      if (resp.session.phase === 'report') {
        toast.success('Interview complete! Generating report...');
        setTimeout(() => router.push(`/panel/${sessionId}/report`), 2000);
        return;
      }
      setResponse(resp);
      setAnswer('');
      setShowEval(false);
      setIsFollowUpMode(false);
      if (resp.currentQuestion?.type === 'coding') {
        setSelectedLang(resp.currentQuestion.editor?.languageOptions[0] ?? 'javascript');
        setAnswer(resp.currentQuestion.editor?.starterCode ?? '');
      }
      if (resp.currentQuestion) void speakQuestion(resp.currentQuestion);
    } catch {
      toast.error('Failed to skip question');
    } finally {
      setSkipping(false);
    }
  };

  const handleAbandon = async () => {
    if (abandoning) return;
    setAbandoning(true);
    try {
      await panelApi.abandonInterview(sessionId);
      toast('Interview exited. Your partial report has been generated and will be emailed to you.', { icon: '📧', duration: 5000 });
      if (ttsEnabled) void speak('Interview exited. Your report has been generated and will be sent to your email.');
      setTimeout(() => router.push(`/panel/${sessionId}/report`), 2500);
    } catch {
      toast.error('Failed to exit interview');
      setAbandoning(false);
    } finally {
      setShowExitDialog(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────

  if (!response) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Panelists are preparing your question...</p>
        </div>
      </div>
    );
  }

  const { session, panel = [], currentQuestion } = response;
  const pConfig = currentQuestion ? (PANELIST_CONFIG[currentQuestion.askedBy] ?? PANELIST_CONFIG['Panelist A']) : null;
  const isCode = currentQuestion?.type === 'coding';
  const isSql = currentQuestion?.type === 'query';
  const canSubmit = answer.trim().length > 0 && !submitting;
  const publicTestCases = currentQuestion?.editor?.testCases.filter((tc) => tc.input !== '[hidden]') ?? [];

  // Derived score stats
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const totalMaxScore = scores.length * 10;
  const totalScore = scores.reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-slate-900 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold flex items-center gap-2">
              <Image src="/logo.png" alt="Avantika Interview AI" width={26} height={26} className="rounded-full" />
              <span>Avantika <span className="text-purple-400">Interview AI</span></span>
            </span>
          <span className={`text-xs px-2 py-1 rounded-full bg-white/10`}>
            {PHASE_LABELS[session.phase] ?? session.phase}
          </span>
          <span className="text-xs text-slate-500">
            {session.track} · {session.experienceYears} yrs · {session.role}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Running score */}
          {scores.length > 0 && (
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10 text-xs">
              <span className="text-slate-400">Score</span>
              <span className={`font-bold tabular-nums ${avgScore !== null && avgScore >= 7 ? 'text-green-400' : avgScore !== null && avgScore >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                {totalScore}/{totalMaxScore}
              </span>
              <span className="text-slate-500">({scores.length}q)</span>
            </div>
          )}
          {/* TTS toggle */}
          <button
            onClick={() => { setTtsEnabled((v) => !v); window.speechSynthesis?.cancel(); }}
            title={ttsEnabled ? 'Mute panelist voice' : 'Unmute panelist voice'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition ${ttsEnabled ? 'border-indigo-500/50 text-indigo-300 bg-indigo-900/20' : 'border-white/10 text-slate-500'}`}
          >
            {ttsEnabled ? '🔊' : '🔇'} Voice
          </button>
          {/* Replay TTS */}
          {ttsEnabled && currentQuestion && (
            <button
              onClick={() => void speakQuestion(currentQuestion)}
              disabled={isSpeaking}
              title="Re-read question"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-white/10 text-slate-400 hover:text-white hover:border-white/30 transition disabled:opacity-40"
            >
              {isSpeaking ? '⏳' : '▶️'} {isSpeaking ? 'Speaking…' : 'Re-read'}
            </button>
          )}
          {/* Exit interview button */}
          <button
            onClick={() => setShowExitDialog(true)}
            title="Exit interview"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-red-700/50 text-red-400 hover:bg-red-900/20 hover:border-red-500 transition"
          >
            🚪 Exit
          </button>
          {/* Panelist indicators */}
          {panel.map((p) => {
            const cfg = PANELIST_CONFIG[p.name];
            const isActive = currentQuestion?.askedBy === p.name;

            // Determine panelist phase ownership
            const panelistPhases: Record<string, string[]> = {
              'Panelist A': ['warmup', 'core'],
              'Panelist B': ['coding'],
              'Panelist C': ['query'],
            };
            const phaseOrder = ['warmup', 'core', 'coding', 'query', 'report'];
            const currentPhaseIdx = phaseOrder.indexOf(session.phase);
            const myPhases = panelistPhases[p.name] ?? [];
            const myLastPhaseIdx = Math.max(...myPhases.map((ph) => phaseOrder.indexOf(ph)));
            const myFirstPhaseIdx = Math.min(...myPhases.map((ph) => phaseOrder.indexOf(ph)));
            const isDone = currentPhaseIdx > myLastPhaseIdx;
            const isUpcoming = currentPhaseIdx < myFirstPhaseIdx;

            return (
              <div
                key={p.name}
                title={isDone ? `${p.name} — Done` : isActive ? `${p.name} — Speaking now` : isUpcoming ? `${p.name} — Up next` : `${p.name} — Waiting`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition ${
                  isActive
                    ? `${cfg?.bg ?? ''} ${cfg?.color ?? ''} ring-1 ring-current`
                    : isDone
                    ? 'border-green-800/50 text-green-600 bg-green-950/20'
                    : isUpcoming
                    ? 'border-white/10 text-slate-500'
                    : `border-${cfg?.color?.replace('text-', '') ?? 'white/10'} text-slate-400 opacity-60`
                }`}
              >
                <span>{cfg?.icon}</span>
                <span>{p.name}</span>
                {isActive && isSpeaking && <span className="animate-pulse">🎤</span>}
                {isActive && !isSpeaking && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                {isDone && <span className="text-green-500">✓</span>}
              </div>
            );
          })}
        </div>
      </header>

      {/* Animated score pop */}
      {animScore !== null && (
        <div className="fixed top-20 right-8 z-50 pointer-events-none animate-bounce">
          <div className={`text-4xl font-black px-6 py-3 rounded-2xl shadow-2xl border-2 ${
            animScore >= 7 ? 'bg-green-900 border-green-400 text-green-300' :
            animScore >= 4 ? 'bg-yellow-900 border-yellow-400 text-yellow-300' :
            'bg-red-900 border-red-400 text-red-300'
          }`}>
            {animScore >= 7 ? '✅' : animScore >= 4 ? '⚠️' : '❌'} {animScore}/10
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {/* Score history bar */}
        {scores.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 shrink-0">Progress</span>
            <div className="flex gap-1 flex-1 flex-wrap">
              {scores.map((s, i) => (
                <div
                  key={i}
                  title={`Q${i + 1}: ${s}/10`}
                  className={`h-2 flex-1 min-w-[12px] rounded-full ${
                    s >= 7 ? 'bg-green-500' : s >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                />
              ))}
            </div>
            {avgScore !== null && (
              <span className={`text-xs font-bold tabular-nums shrink-0 ${avgScore >= 7 ? 'text-green-400' : avgScore >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                avg {avgScore.toFixed(1)}
              </span>
            )}
          </div>
        )}

        {/* Panelist intro */}
        {currentQuestion && pConfig && (
          <div className={`flex items-start gap-4 p-5 rounded-2xl border ${pConfig.bg} ${isSpeaking ? 'ring-2 ring-indigo-500/40' : ''} transition`}>
            <div className="relative">
              <span className="text-3xl mt-0.5">{pConfig.icon}</span>
              {isSpeaking && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-400 animate-ping" />
              )}
            </div>
            <div className="flex-1">
              <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${pConfig.color}`}>
                {currentQuestion.askedBy} · {panel.find((p) => p.name === currentQuestion.askedBy)?.role}
              </div>

              {/* Follow-up mode */}
              {isFollowUpMode && lastEval?.followUpQuestion ? (
                <>
                  <div className="text-xs text-yellow-400 mb-2 font-medium">⚡ Follow-up question</div>
                  <p className="text-base font-medium leading-relaxed">{lastEval.followUpQuestion}</p>
                </>
              ) : (
                <>
                  <p className="text-base font-medium leading-relaxed mb-2">{currentQuestion.questionText}</p>
                  {currentQuestion.constraints && (
                    <p className="text-sm text-slate-400 mt-2">
                      <span className="text-slate-500 font-medium">Constraints: </span>
                      {currentQuestion.constraints}
                    </p>
                  )}
                  {currentQuestion.schemaInfo && (
                    <pre className="mt-3 text-xs font-mono text-slate-300 bg-slate-900 border border-white/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                      {currentQuestion.schemaInfo}
                    </pre>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Evaluation result */}
        {showEval && lastEval && !isFollowUpMode && (
          <div className={`rounded-2xl border p-5 ${lastEval.score >= 7 ? 'bg-green-900/15 border-green-700/40' : lastEval.score >= 4 ? 'bg-yellow-900/15 border-yellow-700/40' : 'bg-red-900/15 border-red-700/40'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Panel Feedback</span>
              <div className="flex items-center gap-3">
                {/* Score bar */}
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${lastEval.score >= 7 ? 'bg-green-400' : lastEval.score >= 4 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${lastEval.score * 10}%` }}
                    />
                  </div>
                  <span className={`text-2xl font-extrabold ${lastEval.score >= 7 ? 'text-green-400' : lastEval.score >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {lastEval.score}/10
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-4">{lastEval.feedback}</p>
            <button
              onClick={handleContinueAfterEval}
              className="mt-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Follow-up evaluation */}
        {showEval && lastEval && isFollowUpMode && (
          <div className="rounded-2xl border border-indigo-700/40 bg-indigo-900/15 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Follow-up Feedback</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-400 transition-all duration-700" style={{ width: `${lastEval.score * 10}%` }} />
                </div>
                <span className="text-xl font-bold text-indigo-300">{lastEval.score}/10</span>
              </div>
            </div>
            <p className="text-sm text-slate-300">{lastEval.feedback}</p>
          </div>
        )}

        {/* Answer area */}
        {currentQuestion && !showEval && (
          <div className="space-y-4">
            {/* Language selector for coding */}
            {isCode && currentQuestion.editor && currentQuestion.editor.languageOptions.length > 1 && (
              <div className="flex gap-2">
                {currentQuestion.editor.languageOptions.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setSelectedLang(lang);
                      setAnswer(currentQuestion.editor?.starterCode ?? '');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      selectedLang === lang ? 'bg-green-700 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}

            {/* Public test cases */}
            {isCode && publicTestCases.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Visible Test Cases</p>
                {publicTestCases.map((tc, i) => (
                  <div key={i} className="flex gap-4 bg-slate-900 border border-white/10 rounded-lg p-3 text-xs font-mono text-slate-300">
                    <span><span className="text-slate-500">Input: </span>{tc.input}</span>
                    <span><span className="text-slate-500">Output: </span>{tc.output}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Code / SQL / Text editor */}
            <div className="relative">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                spellCheck={false}
                className={`w-full rounded-xl border p-4 text-sm focus:outline-none focus:border-indigo-500 resize-none transition ${
                  isCode
                    ? 'h-80 bg-slate-900 border-white/10 font-mono text-green-300'
                    : isSql
                    ? 'h-48 bg-slate-900 border-white/10 font-mono text-blue-300'
                    : 'h-48 bg-white/5 border-white/10 text-white'
                } ${isListening ? 'ring-2 ring-red-500/60' : ''}`}
                placeholder={
                  isCode
                    ? `// Write your ${selectedLang} solution here...`
                    : isSql
                    ? '-- Write your SQL query here...'
                    : isFollowUpMode
                    ? 'Answer the follow-up question...'
                    : 'Type your answer here or use the mic 🎤'
                }
              />
              <span className={`absolute top-3 right-3 text-[10px] font-mono uppercase ${isCode ? 'text-green-600' : isSql ? 'text-blue-600' : 'text-slate-600'}`}>
                {isCode ? selectedLang : isSql ? 'SQL' : 'text'}
              </span>
              {/* Listening pulse */}
              {isListening && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-red-400 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  Listening…
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {isFollowUpMode ? '⚡ Answer the follow-up to continue' : `${PHASE_LABELS[session.phase] ?? session.phase} · Q${session.questionIndex + 1}`}
                </span>
                {/* Mic button — only for text/follow-up answers, not code/SQL */}
                {!isCode && !isSql && (
                  <button
                    onClick={isListening ? stopListening : startListening}
                    title={isListening ? 'Stop recording' : 'Speak your answer'}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      isListening
                        ? 'bg-red-700 border-red-500 text-white animate-pulse'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
                    }`}
                  >
                    {isListening ? '⏹ Stop' : '🎤 Speak'}
                  </button>
                )}
                {/* Skip button */}
                {!isFollowUpMode && (
                  <button
                    onClick={handleSkip}
                    disabled={skipping || submitting}
                    title="Skip this question (score 0)"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-yellow-700/50 text-yellow-500 hover:bg-yellow-900/20 hover:border-yellow-500 transition disabled:opacity-40"
                  >
                    {skipping ? '⏳ Skipping…' : '⏭ Skip'}
                  </button>
                )}
              </div>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition"
              >
                {submitting ? 'Analysing…' : 'Submit Answer →'}
              </button>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Exit Interview Confirmation Modal ─────────────────────── */}
      {showExitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-red-800/50 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🚪</div>
              <h2 className="text-xl font-bold text-white mb-2">Exit Interview?</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your interview will be ended early. A partial report will be generated from the{' '}
                <span className="text-white font-semibold">{scores.length} question{scores.length !== 1 ? 's' : ''}</span> you&apos;ve answered so far, and emailed to your registered address.
              </p>
            </div>

            {/* Score preview */}
            {scores.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-4 mb-6 text-center">
                <div className="text-xs text-slate-500 mb-1">Current score</div>
                <div className={`text-3xl font-black ${
                  (totalScore / (scores.length * 10)) >= 0.7 ? 'text-green-400' :
                  (totalScore / (scores.length * 10)) >= 0.4 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {totalScore}/{scores.length * 10}
                </div>
                <div className="text-xs text-slate-500 mt-1">{scores.length} answered · remaining questions will be scored 0</div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowExitDialog(false)}
                disabled={abandoning}
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition text-sm font-medium disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleAbandon}
                disabled={abandoning}
                className="flex-1 px-4 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold transition text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {abandoning ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Exiting…</>
                ) : (
                  '🚪 Exit & Get Report'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
