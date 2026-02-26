'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { interviewsApi } from '@/lib/api';
import { useIntegrityMonitor } from '@/hooks/useIntegrityMonitor';

interface Option { id: string; text: string }
interface TestCase { input: string; isPublic: boolean; expectedOutput: string }
interface CodingConfig { allowedLanguages: string[]; starterCode?: Record<string, string>; testCases: TestCase[] }
interface Question {
  id: string;
  type: 'mcq' | 'coding' | 'behavioral' | 'system_design';
  difficulty: string;
  content: string;
  options?: Option[];
  codingConfig?: CodingConfig;
}

interface QuestionState {
  question: Question;
  index: number;
  total: number;
  timeRemainingSeconds: number;
}

export default function InterviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [state, setState] = useState<QuestionState | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [code, setCode] = useState('');
  const [selectedLang, setSelectedLang] = useState('javascript');
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useIntegrityMonitor({ sessionId, questionId: state?.question.id });

  const finishSession = useCallback(async () => {
    if (completing) return;
    setCompleting(true);
    try {
      await interviewsApi.completeSession(sessionId);
      toast.success('Interview complete! Generating your report...');
      router.push(`/report/${sessionId}`);
    } catch {
      router.push('/dashboard');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, router]);

  const loadNextQuestion = useCallback(async () => {
    try {
      const { data } = await interviewsApi.getNextQuestion(sessionId);
      setState(data);
      setSelectedOptions([]);
      setTextAnswer('');
      setStartTime(Date.now());
      setTimeLeft(data.timeRemainingSeconds);
      if (data.question.type === 'coding') {
        const lang = data.question.codingConfig?.allowedLanguages[0] ?? 'javascript';
        setSelectedLang(lang);
        setCode(data.question.codingConfig?.starterCode?.[lang] ?? '');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (msg.includes('No more questions')) {
        await finishSession();
      } else {
        toast.error('Could not load next question');
      }
    }
  }, [sessionId, finishSession]);

  useEffect(() => { void loadNextQuestion(); }, [loadNextQuestion]);

  // Countdown timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          void finishSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state?.question.id, finishSession]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const submitAnswer = async () => {
    if (!state) return;
    setSubmitting(true);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const q = state.question;

    const payload: Record<string, unknown> = {
      questionId: q.id,
      timeTakenSeconds: timeTaken,
    };
    if (q.type === 'mcq') payload.selectedOptionIds = selectedOptions;
    else if (q.type === 'coding') { payload.submittedText = code; payload.programmingLanguage = selectedLang; }
    else payload.submittedText = textAnswer;

    try {
      const { data } = await interviewsApi.submitAnswer(sessionId, payload);
      if (data.nextAvailable) {
        await loadNextQuestion();
      } else {
        await finishSession();
      }
    } catch {
      toast.error('Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white animate-pulse">Loading question...</div>
      </div>
    );
  }

  const q = state.question;
  const isAnswered =
    (q.type === 'mcq' && selectedOptions.length > 0) ||
    (q.type === 'coding' && code.trim().length > 0) ||
    ((q.type === 'behavioral' || q.type === 'system_design') && textAnswer.trim().length > 10);

  const timerColor = timeLeft < 300 ? 'text-red-400' : timeLeft < 600 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-slate-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">🤖 InterviewAI</span>
          <span className="text-xs text-slate-400">
            Question {state.index + 1} of {state.total}
          </span>
          <div className="w-40 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${((state.index + 1) / state.total) * 100}%` }}
            />
          </div>
        </div>
        <div className={`text-lg font-mono font-bold ${timerColor}`}>
          ⏱ {formatTime(timeLeft)}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
        {/* Question header */}
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
            q.type === 'mcq' ? 'border-blue-600/50 bg-blue-900/20 text-blue-300' :
            q.type === 'coding' ? 'border-green-600/50 bg-green-900/20 text-green-300' :
            q.type === 'behavioral' ? 'border-purple-600/50 bg-purple-900/20 text-purple-300' :
            'border-orange-600/50 bg-orange-900/20 text-orange-300'
          }`}>{q.type.replace('_', ' ')}</span>
          <span className="text-xs text-slate-400 capitalize">• {q.difficulty}</span>
        </div>

        {/* Question text */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <p className="text-base leading-relaxed whitespace-pre-wrap">{q.content}</p>
        </div>

        {/* Answer area */}
        {q.type === 'mcq' && q.options && (
          <div className="space-y-3">
            {q.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedOptions((prev) =>
                  prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                )}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${
                  selectedOptions.includes(opt.id)
                    ? 'border-indigo-500 bg-indigo-600/20 text-white'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30'
                }`}
              >
                {opt.text}
              </button>
            ))}
          </div>
        )}

        {q.type === 'coding' && (
          <div className="space-y-3">
            {q.codingConfig && q.codingConfig.allowedLanguages.length > 1 && (
              <div className="flex gap-2">
                {q.codingConfig.allowedLanguages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => { setSelectedLang(lang); setCode(q.codingConfig?.starterCode?.[lang] ?? ''); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selectedLang === lang ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
            {q.codingConfig?.testCases.filter((tc) => tc.isPublic).map((tc, i) => (
              <div key={i} className="bg-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300">
                <span className="text-slate-500">Input: </span>{tc.input} <span className="text-slate-500 ml-3">Expected: </span>{tc.expectedOutput}
              </div>
            ))}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onPaste={(e) => e.preventDefault()}
              spellCheck={false}
              className="w-full h-72 bg-slate-900 border border-white/10 rounded-xl p-4 text-sm font-mono text-green-300 focus:outline-none focus:border-indigo-500 resize-none"
              placeholder={`// Write your ${selectedLang} solution here...`}
            />
          </div>
        )}

        {(q.type === 'behavioral' || q.type === 'system_design') && (
          <textarea
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            className="w-full h-56 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            placeholder={
              q.type === 'behavioral'
                ? 'Describe your experience using the STAR method (Situation, Task, Action, Result)...'
                : 'Describe your system design approach, components, trade-offs, and scalability considerations...'
            }
          />
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-auto">
          <button
            onClick={finishSession}
            className="text-sm text-slate-500 hover:text-slate-300 transition"
          >
            End Interview
          </button>
          <button
            onClick={submitAnswer}
            disabled={!isAnswered || submitting}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition"
          >
            {submitting ? 'Submitting...' : state.index + 1 === state.total ? 'Submit & Finish' : 'Next Question →'}
          </button>
        </div>
      </div>
    </div>
  );
}
