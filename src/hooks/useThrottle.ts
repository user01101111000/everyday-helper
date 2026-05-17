import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Options to configure throttle edge behavior.
 *
 * - `leading`  → invoke on the first call of a cycle (immediately).
 * - `trailing` → invoke once more at the end of a cycle with the latest args.
 *
 * Setting both to `false` produces a no-op throttle.
 */
export interface ThrottleOptions {
  /**
   * Invoke on the leading edge of the timeout window.
   * @default true
   */
  leading?: boolean;
  /**
   * Invoke on the trailing edge of the timeout window with the most recent args.
   * @default true
   */
  trailing?: boolean;
}

/**
 * A function wrapped with throttle semantics, returned by {@link useThrottleCallback}.
 *
 * The wrapped callback's return value is discarded — throttled functions are fire-and-forget.
 *
 * @template TArgs Tuple of argument types accepted by the wrapped callback.
 */
export interface ThrottledFunction<TArgs extends readonly unknown[]> {
  /** Invoke the throttled function. Honors the configured throttle policy. */
  (...args: TArgs): void;
  /** Drop any pending trailing invocation and reset the throttle window. */
  cancel: () => void;
  /** Immediately invoke the pending trailing call (if any) and reset the throttle window. */
  flush: () => void;
}

/**
 * Throttle a value: returns a copy of `value` that updates at most once per `delay` ms.
 *
 * Ideal for high-frequency value changes (scroll position, mouse coordinates, search input)
 * where rendering on every change would be wasteful.
 *
 * SSR-safe — all timer work happens inside `useEffect`, so the hook is safe under
 * Next.js (App & Pages router), Remix, and other server-rendered environments.
 *
 * @template T Type of the throttled value.
 * @param value The current value (may change on every render).
 * @param delay Minimum interval between updates of the returned value, in milliseconds.
 *              Defaults to `500`. Values `<= 0` effectively disable throttling.
 * @returns The throttled value.
 *
 * @example
 * ```tsx
 * const [query, setQuery] = useState('');
 * const throttledQuery = useThrottle(query, 300);
 *
 * useEffect(() => {
 *   if (throttledQuery) fetchResults(throttledQuery);
 * }, [throttledQuery]);
 * ```
 */
export function useThrottle<T>(value: T, delay: number = 500): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdatedAtRef = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    const remaining = delay - (now - lastUpdatedAtRef.current);

    if (remaining <= 0) {
      lastUpdatedAtRef.current = now;
      setThrottledValue(value);
      return;
    }

    const timer = setTimeout(() => {
      lastUpdatedAtRef.current = Date.now();
      setThrottledValue(value);
    }, remaining);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return throttledValue;
}

/**
 * Throttle a callback: returns a function that, however frequently called, invokes
 * the wrapped callback at most once per `delay` ms.
 *
 * The returned function:
 * - has a **stable identity** across renders as long as `delay`/`leading`/`trailing`
 *   don't change — safe to pass to `useEffect` deps or memoized children.
 * - always calls the **latest** version of `callback` (no stale closures, even if
 *   `callback` is recreated on every render).
 * - exposes `.cancel()` to drop a pending trailing invocation.
 * - exposes `.flush()` to immediately invoke a pending trailing invocation.
 *
 * Automatically cancels pending invocations on unmount.
 *
 * SSR-safe — nothing executes at module load or render time; timers only start
 * once the throttled function is actually invoked.
 *
 * @template TArgs Tuple of argument types accepted by `callback`.
 * @param callback The function to throttle. Its return value is discarded.
 * @param delay Minimum interval between invocations, in milliseconds. Defaults to `500`.
 * @param options Edge configuration. Defaults to `{ leading: true, trailing: true }`.
 * @returns A throttled wrapper with `.cancel()` and `.flush()` helpers.
 *
 * @example
 * ```tsx
 * // Next.js: rate-limit a resize handler
 * const onWidthChange = useThrottleCallback((width: number) => {
 *   setBreakpoint(width < 768 ? 'mobile' : 'desktop');
 * }, 200);
 *
 * useEffect(() => {
 *   const handle = () => onWidthChange(window.innerWidth);
 *   window.addEventListener('resize', handle);
 *   return () => {
 *     window.removeEventListener('resize', handle);
 *     onWidthChange.cancel();
 *   };
 * }, [onWidthChange]);
 * ```
 *
 * @example
 * ```tsx
 * // Trailing-only: fire after the user stops scrolling
 * const onScroll = useThrottleCallback(
 *   (y: number) => analytics.track('scroll', { y }),
 *   500,
 *   { leading: false, trailing: true },
 * );
 * ```
 */
export function useThrottleCallback<TArgs extends readonly unknown[]>(
  callback: (...args: TArgs) => unknown,
  delay: number = 500,
  options: ThrottleOptions = {},
): ThrottledFunction<TArgs> {
  const { leading = true, trailing = true } = options;

  const callbackRef = useRef(callback);
  const lastInvokedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<TArgs | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const invoke = useCallback((args: TArgs) => {
    lastInvokedAtRef.current = Date.now();
    pendingArgsRef.current = null;
    callbackRef.current(...args);
  }, []);

  const throttled = useMemo<ThrottledFunction<TArgs>>(() => {
    const scheduleTrailing = (wait: number) => {
      if (timerRef.current !== null) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingArgsRef.current;
        if (pending) invoke(pending);
      }, wait);
    };

    const fn = ((...args: TArgs): void => {
      const now = Date.now();
      const elapsed = now - lastInvokedAtRef.current;
      const remaining = elapsed < 0 ? 0 : delay - elapsed;

      if (remaining <= 0) {
        clearTimer();
        if (leading) {
          invoke(args);
          return;
        }
        lastInvokedAtRef.current = now;
        if (trailing) {
          pendingArgsRef.current = args;
          scheduleTrailing(delay);
        }
        return;
      }

      if (trailing) {
        pendingArgsRef.current = args;
        scheduleTrailing(remaining);
      }
    }) as ThrottledFunction<TArgs>;

    fn.cancel = () => {
      clearTimer();
      pendingArgsRef.current = null;
      lastInvokedAtRef.current = 0;
    };

    fn.flush = () => {
      const pending = pendingArgsRef.current;
      clearTimer();
      if (pending) invoke(pending);
    };

    return fn;
  }, [delay, leading, trailing, clearTimer, invoke]);

  useEffect(() => {
    return () => {
      clearTimer();
      pendingArgsRef.current = null;
    };
  }, [clearTimer]);

  return throttled;
}
