'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { paymentsApi } from '@/lib/api';

// INR amounts for Razorpay (shown alongside USD on cards)
const PLAN_INR: Record<string, Record<string, number>> = {
  pro:        { monthly: 1599, yearly: 1199 },
  enterprise: { monthly: 6599, yearly: 4999 },
};

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById('rzp-script')) { resolve(true); return; }
    const s = document.createElement('script');
    s.id = 'rzp-script';
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// ── Plan definitions ──────────────────────────────────────────────

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    icon: '🆓',
    monthlyPrice: 0,
    yearlyPrice: 0,
    color: 'border-slate-600/50',
    badge: null,
    cta: 'Get Started',
    ctaStyle: 'bg-white/10 hover:bg-white/20 border border-white/20 text-white',
    description: 'Perfect for trying out the platform.',
    features: [
      '3 AI interviews per month',
      '2 interview tracks (MCQ + Behavioral)',
      'Basic score report',
      'Text answers only',
      'Community support',
    ],
    missing: [
      'Coding & SQL rounds',
      'Panel interview mode',
      'Email reports',
      'Voice interaction',
      'Recruiter dashboard',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: '⚡',
    monthlyPrice: 19,
    yearlyPrice: 14,
    color: 'border-indigo-500/70',
    badge: 'Most Popular',
    badgeColor: 'bg-indigo-600 text-white',
    cta: 'Start Pro Trial',
    ctaStyle: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50',
    description: 'For serious candidates preparing for top companies.',
    features: [
      '30 AI interviews per month',
      'All 8 interview tracks',
      'Panel interview mode (3 panelists)',
      'Voice questions & mic answers',
      'Detailed AI feedback + scores',
      'Email PDF reports',
      'Coding sandbox (JavaScript, Python, Java)',
      'Skip & exit with partial reports',
      'Priority support',
    ],
    missing: [
      'Unlimited interviews',
      'Custom question sets',
      'Team / recruiter access',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: '🏢',
    monthlyPrice: 79,
    yearlyPrice: 59,
    color: 'border-orange-500/70',
    badge: 'Best Value',
    badgeColor: 'bg-orange-500 text-white',
    cta: 'Contact Sales',
    ctaStyle: 'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-900/50',
    description: 'For teams and companies running real hiring pipelines.',
    features: [
      'Unlimited AI interviews',
      'All Pro features included',
      'Recruiter dashboard & analytics',
      'Custom question sets per role',
      'Candidate management & tagging',
      'Bulk invite candidates via email',
      'ATS integration (Greenhouse, Lever)',
      'White-label interview portal',
      'Dedicated account manager',
      'SSO / SAML support',
      'SLA guarantee',
    ],
    missing: [],
  },
];

const FAQS = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. You can cancel your subscription at any time from your account settings. Your plan stays active until the end of the billing period.',
  },
  {
    q: 'Is there a free trial for Pro?',
    a: 'Yes — Pro includes a 7-day free trial. No credit card required to start.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit/debit cards (Visa, Mastercard, Amex) and UPI for Indian customers.',
  },
  {
    q: 'Can I upgrade or downgrade my plan?',
    a: 'Absolutely. You can switch plans at any time. Upgrades take effect immediately; downgrades apply at the next billing cycle.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. All interview data is encrypted at rest and in transit. We never share your data with third parties.',
  },
  {
    q: 'Do you offer student discounts?',
    a: 'Yes — students get 50% off Pro with a valid .edu email. Reach out to support@interviewai.dev.',
  },
];

// ── Component ─────────────────────────────────────────────────────

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const router = useRouter();

  const handlePaidPlan = async (planId: string) => {
    if (planId === 'free') { router.push('/register'); return; }
    if (planId === 'enterprise') { window.location.href = 'mailto:sales@interviewai.dev'; return; }
    setPaying(planId);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { alert('Failed to load payment gateway. Please try again.'); setPaying(null); return; }

      const { data: order } = await paymentsApi.createOrder(planId, billing);

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Avantika Interview AI',
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan — ${billing}`,
        order_id: order.orderId,
        theme: { color: '#4f46e5' },
        handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          // Store payment proof, then send user to register
          sessionStorage.setItem('pending_payment', JSON.stringify({
            plan: planId,
            billing,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }));
          router.push(`/register?plan=${planId}`);
        },
        modal: { ondismiss: () => setPaying(null) },
      };

      new window.Razorpay(options).open();
    } catch {
      alert('Failed to initiate payment. Please try again.');
      setPaying(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <Logo size={36} />
        <nav className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-slate-300 hover:text-white transition">Sign in</Link>
          <Link href="/register" className="text-sm bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium transition">
            Get Started
          </Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-4xl mx-auto text-center px-6 pt-20 pb-10">
        <div className="inline-flex items-center gap-2 bg-indigo-900/50 border border-indigo-700/50 rounded-full px-4 py-1.5 text-sm text-indigo-300 mb-6">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Simple, transparent pricing
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent">
          Choose Your Plan
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10">
          Start free. Upgrade when you're ready. No hidden fees, no surprises.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${billing === 'monthly' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${billing === 'yearly' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Yearly
            <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
              Save 25%
            </span>
          </button>
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="max-w-6xl mx-auto px-6 pb-16 grid md:grid-cols-3 gap-6 items-stretch">
        {PLANS.map((plan) => {
          const price = billing === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
          const isPopular = plan.id === 'pro';

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-8 bg-white/[0.03] backdrop-blur-sm transition hover:bg-white/[0.06] ${plan.color} ${isPopular ? 'ring-2 ring-indigo-500/50 scale-[1.02]' : ''}`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold ${plan.badgeColor}`}>
                  {plan.badge}
                </div>
              )}

              {/* Plan header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{plan.icon}</span>
                  <span className="text-lg font-bold">{plan.name}</span>
                </div>
                <p className="text-sm text-slate-400">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-8">
                {price === 0 ? (
                  <div className="text-4xl font-extrabold">Free</div>
                ) : (
                  <div className="flex items-end gap-1">
                    <span className="text-slate-400 text-lg">$</span>
                    <span className="text-5xl font-extrabold tabular-nums">{price}</span>
                    <span className="text-slate-400 mb-1.5">/ mo</span>
                  </div>
                )}
                {billing === 'yearly' && price > 0 && (
                  <p className="text-xs text-green-400 mt-1">
                    Billed annually (${price * 12}/yr)
                  </p>
                )}
              </div>

              {/* CTA */}
              <button
                onClick={() => handlePaidPlan(plan.id)}
                disabled={paying === plan.id}
                className={`w-full text-center py-3 rounded-xl font-semibold text-sm transition mb-8 block ${plan.ctaStyle} disabled:opacity-60 disabled:cursor-wait`}
              >
                {paying === plan.id ? 'Opening payment...' : plan.cta}
              </button>

              {/* Features */}
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">What's included</p>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-200">
                      <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.missing.length > 0 && (
                  <ul className="space-y-2.5 mt-3">
                    {plan.missing.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-500">
                        <span className="mt-0.5 shrink-0">✕</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Trust bar ── */}
      <section className="border-y border-white/10 bg-white/[0.02] py-8">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { icon: '🔒', label: 'Secure Payments', sub: 'Powered by Stripe' },
            { icon: '🔄', label: 'Cancel Anytime', sub: 'No lock-in contracts' },
            { icon: '🎓', label: 'Student Discount', sub: '50% off with .edu email' },
            { icon: '💬', label: '24/7 Support', sub: 'Always here to help' },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-sm font-semibold text-white">{item.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{item.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature comparison table ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">Full Feature Comparison</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-6 py-4 text-slate-400 font-medium w-1/2">Feature</th>
                <th className="px-4 py-4 text-center text-slate-400 font-medium">Free</th>
                <th className="px-4 py-4 text-center font-semibold text-indigo-300">Pro</th>
                <th className="px-4 py-4 text-center text-orange-300 font-medium">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {COMPARISON_ROWS.map((row, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition">
                  <td className="px-6 py-3.5 text-slate-300">{row.feature}</td>
                  <td className="px-4 py-3.5 text-center">{renderCell(row.free)}</td>
                  <td className="px-4 py-3.5 text-center bg-indigo-900/10">{renderCell(row.pro)}</td>
                  <td className="px-4 py-3.5 text-center">{renderCell(row.enterprise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center mb-10">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="border border-white/10 rounded-xl bg-white/[0.03] overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left text-sm font-medium text-white hover:bg-white/5 transition"
              >
                <span>{faq.q}</span>
                <span className={`text-slate-400 transition-transform duration-200 ${openFaq === i ? 'rotate-45' : ''}`}>＋</span>
              </button>
              {openFaq === i && (
                <div className="px-6 pb-4 text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="border-t border-white/10 bg-indigo-950/30 py-16 text-center px-6">
        <h2 className="text-3xl font-bold mb-4">Ready to ace your next interview?</h2>
        <p className="text-slate-400 mb-8 max-w-xl mx-auto">
          Join thousands of candidates who improved their interview performance with InterviewAI.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/register"
            className="bg-indigo-600 hover:bg-indigo-500 px-8 py-3.5 rounded-xl font-semibold transition shadow-lg shadow-indigo-900/50"
          >
            Start for Free →
          </Link>
          <Link
            href="mailto:sales@interviewai.dev"
            className="bg-white/10 hover:bg-white/20 border border-white/20 px-8 py-3.5 rounded-xl font-semibold transition"
          >
            Talk to Sales
          </Link>
        </div>
      </section>

      <footer className="text-center py-6 text-xs text-slate-600 border-t border-white/5">
        © 2026 Avantika Interview AI · Built with Next.js, NestJS, PostgreSQL &amp; GPT-4o
      </footer>
    </main>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function renderCell(val: string | boolean) {
  if (val === true) return <span className="text-green-400 text-base">✓</span>;
  if (val === false) return <span className="text-slate-600 text-base">✕</span>;
  return <span className="text-slate-300 text-xs">{val}</span>;
}

const COMPARISON_ROWS: { feature: string; free: string | boolean; pro: string | boolean; enterprise: string | boolean }[] = [
  { feature: 'AI interviews per month',   free: '3',         pro: '30',          enterprise: 'Unlimited' },
  { feature: 'Interview tracks',          free: '2',         pro: 'All 8',       enterprise: 'All 8 + Custom' },
  { feature: 'Panel interview (3 voices)',free: false,       pro: true,          enterprise: true },
  { feature: 'Voice questions (TTS)',     free: false,       pro: true,          enterprise: true },
  { feature: 'Mic answers (STT)',         free: false,       pro: true,          enterprise: true },
  { feature: 'Coding sandbox',           free: false,       pro: true,          enterprise: true },
  { feature: 'SQL / query round',        free: false,       pro: true,          enterprise: true },
  { feature: 'Email PDF report',         free: false,       pro: true,          enterprise: true },
  { feature: 'Skip & exit with report',  free: false,       pro: true,          enterprise: true },
  { feature: 'Recruiter dashboard',      free: false,       pro: false,         enterprise: true },
  { feature: 'Custom question sets',     free: false,       pro: false,         enterprise: true },
  { feature: 'Candidate management',     free: false,       pro: false,         enterprise: true },
  { feature: 'ATS integration',          free: false,       pro: false,         enterprise: true },
  { feature: 'White-label portal',       free: false,       pro: false,         enterprise: true },
  { feature: 'SSO / SAML',              free: false,       pro: false,         enterprise: true },
  { feature: 'Support',                  free: 'Community', pro: 'Priority',    enterprise: 'Dedicated manager' },
];
