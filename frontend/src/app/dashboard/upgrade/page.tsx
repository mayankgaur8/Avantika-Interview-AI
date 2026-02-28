'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Logo } from '@/components/Logo';
import { useAuthStore } from '@/store/authStore';
import { paymentsApi } from '@/lib/api';

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    icon: '⚡',
    monthlyINR: 1599,
    yearlyINR: 1199,
    color: 'border-indigo-500/70',
    badge: 'Most Popular',
    badgeColor: 'bg-indigo-600 text-white',
    ctaStyle: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50',
    features: [
      '30 AI interviews per month',
      'All 8 interview tracks',
      'Panel interview mode (3 panelists)',
      'Voice questions & mic answers',
      'Detailed AI feedback + scores',
      'Email PDF reports',
      'Coding sandbox (JavaScript, Python, Java)',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: '🏢',
    monthlyINR: 6599,
    yearlyINR: 4999,
    color: 'border-orange-500/70',
    badge: 'Best Value',
    badgeColor: 'bg-orange-500 text-white',
    ctaStyle: 'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-900/50',
    features: [
      'Unlimited AI interviews',
      'All Pro features included',
      'Recruiter dashboard & analytics',
      'Custom question sets per role',
      'Candidate management & tagging',
      'Bulk invite candidates via email',
      'White-label interview portal',
      'Dedicated account manager',
      'SSO / SAML support',
    ],
  },
];

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-script')) { resolve(true); return; }
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function UpgradePage() {
  const { user, fetchMe } = useAuthStore();
  const router = useRouter();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    setLoading(planId);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error('Failed to load payment gateway'); return; }

      const { data: order } = await paymentsApi.createOrder(planId, billing);

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Avantika Interview AI',
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan — ${billing}`,
        order_id: order.orderId,
        prefill: { email: user?.email, name: `${user?.firstName} ${user?.lastName}` },
        theme: { color: '#4f46e5' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await paymentsApi.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              plan: planId,
              billing,
            });
            await fetchMe();
            toast.success(`Upgraded to ${planId.charAt(0).toUpperCase() + planId.slice(1)}!`);
            router.push('/dashboard');
          } catch {
            toast.error('Payment verification failed. Contact support.');
          }
        },
        modal: { ondismiss: () => setLoading(null) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      toast.error('Failed to initiate payment');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <Logo size={32} />
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white transition">
          ← Back to Dashboard
        </Link>
      </header>

      <section className="max-w-3xl mx-auto text-center px-6 pt-16 pb-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3 bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent">
          Upgrade Your Plan
        </h1>
        <p className="text-slate-400 text-base mb-8">
          You're on the <span className="text-white font-semibold capitalize">{user?.plan ?? 'Free'}</span> plan.
          Unlock more features below.
        </p>

        <div className="inline-flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1 mb-10">
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
            <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">Save 25%</span>
          </button>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20 grid md:grid-cols-2 gap-6">
        {PLANS.map((plan) => {
          const price = billing === 'monthly' ? plan.monthlyINR : plan.yearlyINR;
          const isCurrentPlan = user?.plan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-8 bg-white/[0.03] backdrop-blur-sm ${plan.color} ${plan.id === 'pro' ? 'ring-2 ring-indigo-500/50' : ''}`}
            >
              {plan.badge && (
                <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold ${plan.badgeColor}`}>
                  {plan.badge}
                </div>
              )}

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{plan.icon}</span>
                  <span className="text-lg font-bold">{plan.name}</span>
                </div>
              </div>

              <div className="mb-7">
                <div className="flex items-end gap-1">
                  <span className="text-slate-400 text-lg">₹</span>
                  <span className="text-5xl font-extrabold tabular-nums">{price.toLocaleString('en-IN')}</span>
                  <span className="text-slate-400 mb-1.5">/ mo</span>
                </div>
                {billing === 'yearly' && (
                  <p className="text-xs text-green-400 mt-1">
                    Billed annually (₹{(price * 12).toLocaleString('en-IN')}/yr)
                  </p>
                )}
              </div>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={!!loading || isCurrentPlan}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition mb-7 ${isCurrentPlan ? 'bg-white/10 text-slate-400 cursor-not-allowed' : plan.ctaStyle} ${loading === plan.id ? 'opacity-70 cursor-wait' : ''}`}
              >
                {isCurrentPlan ? 'Current Plan' : loading === plan.id ? 'Processing...' : `Upgrade to ${plan.name}`}
              </button>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-200">
                    <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <div className="text-center pb-10 text-xs text-slate-500">
        Payments are processed securely via Razorpay · All prices in INR · GST applicable
      </div>
    </div>
  );
}
