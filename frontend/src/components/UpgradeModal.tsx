'use client';

import Link from 'next/link';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  message: string;
  requiredPlan?: 'pro' | 'enterprise';
}

export function UpgradeModal({
  isOpen,
  onClose,
  featureName,
  message,
  requiredPlan = 'pro',
}: UpgradeModalProps) {
  if (!isOpen) return null;

  const isPro = requiredPlan === 'pro';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition text-lg leading-none"
        >
          ✕
        </button>

        {/* Icon */}
        <div className="text-5xl mb-4">{isPro ? '⚡' : '🏢'}</div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white mb-2">
          Upgrade to {isPro ? 'Pro' : 'Enterprise'}
        </h2>

        {/* Feature name */}
        <p className="text-sm font-semibold text-indigo-300 mb-3">{featureName}</p>

        {/* Message */}
        <p className="text-sm text-slate-400 leading-relaxed mb-6">{message}</p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard/upgrade"
            className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition ${
              isPro
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-orange-500 hover:bg-orange-400 text-white'
            }`}
            onClick={onClose}
          >
            Upgrade to {isPro ? 'Pro' : 'Enterprise'} →
          </Link>
          <button
            onClick={onClose}
            className="w-full text-center py-3 rounded-xl text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition"
          >
            Maybe later
          </button>
        </div>

        {/* Plan highlights */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <p className="text-xs text-slate-500 mb-3 font-semibold uppercase tracking-wider">
            {isPro ? 'Pro includes' : 'Enterprise includes'}
          </p>
          <ul className="space-y-1.5">
            {(isPro
              ? [
                  '30 AI interviews per month',
                  'Panel interview mode (3 panelists)',
                  'All 8 interview tracks',
                  'Coding sandbox & SQL rounds',
                  'Voice questions & mic answers',
                  'Email PDF reports',
                ]
              : [
                  'Unlimited AI interviews',
                  'All Pro features',
                  'Recruiter dashboard & analytics',
                  'Custom question sets per role',
                  'ATS integration',
                  'SSO / SAML support',
                ]
            ).map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                <span className="text-green-400">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
