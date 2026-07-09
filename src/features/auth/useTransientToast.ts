import { useCallback, useEffect, useRef, useState } from 'react';

import type { ToastTone } from '@/ui';

// Transient snackbar state for the auth confirmation screens (resend feedback).
// The Toast primitive is presentational; this owns the show-then-auto-dismiss
// lifecycle.
const TOAST_DURATION_MS = 3000;

export interface TransientToast {
  message: string;
  tone: ToastTone;
}

export function useTransientToast(): {
  toast: TransientToast | null;
  showToast: (message: string, tone: ToastTone) => void;
} {
  const [toast, setToast] = useState<TransientToast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const showToast = useCallback((message: string, tone: ToastTone) => {
    setToast({ message, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  return { toast, showToast };
}
