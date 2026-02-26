import { redirect } from 'next/navigation';

/**
 * /report has no standalone view — reports are per-session at /report/[sessionId]
 * or /panel/[sessionId]/report. Redirect to dashboard so the user can pick one.
 */
export default function ReportIndexPage() {
  redirect('/dashboard');
}
