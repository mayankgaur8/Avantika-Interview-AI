'use client';

import { useEffect, useRef, useCallback } from 'react';
import { integrityApi } from '@/lib/api';

type IntegrityEventType =
  | 'tab_switch'
  | 'window_blur'
  | 'copy_paste'
  | 'devtools_open'
  | 'rapid_answer'
  | 'inactivity';

interface UseIntegrityMonitorOptions {
  sessionId: string;
  questionId?: string;
  enabled?: boolean;
}

export function useIntegrityMonitor({
  sessionId,
  questionId,
  enabled = true,
}: UseIntegrityMonitorOptions) {
  const lastActivityRef = useRef<number>(0);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendEvent = useCallback(
    async (eventType: IntegrityEventType, metadata?: Record<string, unknown>) => {
      if (!enabled) return;
      try {
        await integrityApi.recordEvent(sessionId, { eventType, questionId, metadata });
      } catch {
        // silent fail – don't disrupt candidate
      }
    },
    [sessionId, questionId, enabled],
  );

  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      sendEvent('inactivity', { durationMs: 120_000 });
    }, 120_000); // 2 min inactivity
  }, [sendEvent]);

  useEffect(() => {
    if (!enabled) return;

    // Initialise activity timestamp when monitoring starts
    lastActivityRef.current = Date.now();
    const handleVisibilityChange = () => {
      if (document.hidden) {
        sendEvent('tab_switch', { timestamp: Date.now() });
      }
    };

    // Window blur
    const handleBlur = () => sendEvent('window_blur');

    // Copy/paste prevention
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      sendEvent('copy_paste', { type: e.type });
    };

    // Mouse/keyboard activity for inactivity tracking
    const handleActivity = () => resetInactivityTimer();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('copy', handleCopyPaste as EventListener);
    document.addEventListener('paste', handleCopyPaste as EventListener);
    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);

    resetInactivityTimer();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('copy', handleCopyPaste as EventListener);
      document.removeEventListener('paste', handleCopyPaste as EventListener);
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [enabled, sendEvent, resetInactivityTimer]);

  return { sendEvent };
}
