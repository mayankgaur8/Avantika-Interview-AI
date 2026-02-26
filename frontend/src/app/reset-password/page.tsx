'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';

const schema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type Form = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const token = searchParams.get('token') ?? '';

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  if (!email || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <Logo size={44} className="justify-center mb-8" />
          <div className="bg-white/5 border border-red-500/30 rounded-2xl p-8">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-red-400 font-medium mb-2">Invalid reset link</p>
            <p className="text-slate-500 text-sm mb-6">This link is missing required parameters. Please request a new one.</p>
            <Link href="/forgot-password" className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition text-sm">
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email,
        token,
        newPassword: data.newPassword,
      });
      setDone(true);
      toast.success('Password updated!');
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Invalid or expired link. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo size={44} className="justify-center mb-6" />
          <h1 className="text-2xl font-bold text-white mb-1">Set New Password</h1>
          <p className="text-slate-400 text-sm">For <span className="text-indigo-400">{email}</span></p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          {done ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <p className="text-green-400 font-semibold">Password updated!</p>
              <p className="text-slate-400 text-sm">Redirecting you to sign in...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    {...register('newPassword')}
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs transition"
                  >
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="text-red-400 text-xs mt-1">{errors.newPassword.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  {...register('confirmPassword')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Repeat your new password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
                {errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Password strength hint */}
              <div className="bg-white/5 rounded-lg p-3 text-xs text-slate-500 space-y-1">
                <p className="text-slate-400 font-medium mb-1">Password requirements:</p>
                <p>• At least 8 characters</p>
                <p>• Mix of letters and numbers recommended</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition text-sm"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}

          {!done && (
            <p className="text-center text-sm text-slate-500 mt-6">
              Link expired?{' '}
              <Link href="/forgot-password" className="text-indigo-400 hover:text-indigo-300">
                Request a new one
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
