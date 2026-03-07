export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface PlanLimits {
  interviewsPerMonth: number; // Infinity for unlimited
  panelInterview: boolean;
  voiceFeatures: boolean;
  codingSandbox: boolean;
  emailReports: boolean;
  allTracks: boolean;
  recruiterDashboard: boolean;
  skipAndExit: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    interviewsPerMonth: 3,
    panelInterview: false,
    voiceFeatures: false,
    codingSandbox: false,
    emailReports: false,
    allTracks: false,
    recruiterDashboard: false,
    skipAndExit: false,
  },
  pro: {
    interviewsPerMonth: 30,
    panelInterview: true,
    voiceFeatures: true,
    codingSandbox: true,
    emailReports: true,
    allTracks: true,
    recruiterDashboard: false,
    skipAndExit: true,
  },
  enterprise: {
    interviewsPerMonth: Infinity,
    panelInterview: true,
    voiceFeatures: true,
    codingSandbox: true,
    emailReports: true,
    allTracks: true,
    recruiterDashboard: true,
    skipAndExit: true,
  },
};

export function getPlanLimits(plan?: string | null): PlanLimits {
  const tier = (plan ?? 'free') as PlanTier;
  return PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;
}

export function canAccess(feature: keyof PlanLimits, plan?: string | null): boolean {
  const limits = getPlanLimits(plan);
  const val = limits[feature];
  if (typeof val === 'boolean') return val;
  return true;
}

export const PLAN_DISPLAY: Record<PlanTier, { label: string; icon: string; color: string }> = {
  free: { label: 'Free', icon: '🆓', color: 'text-slate-400' },
  pro: { label: 'Pro', icon: '⚡', color: 'text-indigo-300' },
  enterprise: { label: 'Enterprise', icon: '🏢', color: 'text-orange-300' },
};

export const UPGRADE_MESSAGES: Partial<Record<keyof PlanLimits, string>> = {
  panelInterview: 'Panel interviews are available on Pro and Enterprise plans.',
  voiceFeatures: 'Voice questions and mic answers are available on Pro and Enterprise plans.',
  codingSandbox: 'The coding sandbox is available on Pro and Enterprise plans.',
  emailReports: 'Email PDF reports are available on Pro and Enterprise plans.',
  allTracks: 'All 8 interview tracks are available on Pro and Enterprise plans.',
  recruiterDashboard: 'Recruiter dashboard is available on Enterprise plan only.',
  skipAndExit: 'Skip & exit with partial reports is available on Pro and Enterprise plans.',
};
