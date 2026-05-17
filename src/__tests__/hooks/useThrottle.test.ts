import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderHook, act } from '@testing-library/react';

import { useThrottle, useThrottleCallback } from '../../hooks/useThrottle';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('useThrottle (value)', () => {
  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useThrottle('hello', 500));

    expect(result.current).toBe('hello');
  });

  it('should update the throttled value after the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useThrottle(value, 500), {
      initialProps: { value: 'first' },
    });

    rerender({ value: 'second' });

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('second');
  });

  it('should not update the throttled value before the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useThrottle(value, 500), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('a');
  });

  it('should keep only the latest value when changes happen rapidly', () => {
    const { result, rerender } = renderHook(({ value }) => useThrottle(value, 300), {
      initialProps: { value: 'one' },
    });

    rerender({ value: 'two' });
    rerender({ value: 'three' });
    rerender({ value: 'four' });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('four');
  });

  it('should respect a custom delay', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useThrottle(value, delay), {
      initialProps: { value: 'fast', delay: 100 },
    });

    rerender({ value: 'faster', delay: 100 });

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(result.current).toBe('fast');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('faster');
  });

  it('should use the default delay (500ms) when none is provided', () => {
    const { result, rerender } = renderHook(({ value }) => useThrottle(value), {
      initialProps: { value: 1 },
    });

    rerender({ value: 2 });

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(2);
  });

  it('should work with non-primitive values', () => {
    const obj = { count: 5 };
    const { result: objResult } = renderHook(() => useThrottle(obj, 100));
    expect(objResult.current).toEqual({ count: 5 });

    const { result: boolResult } = renderHook(() => useThrottle(true, 100));
    expect(boolResult.current).toBe(true);

    const { result: numResult } = renderHook(() => useThrottle(42, 100));
    expect(numResult.current).toBe(42);
  });

  it('should cleanup the pending timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { rerender, unmount } = renderHook(({ value }) => useThrottle(value, 500), {
      initialProps: { value: 'x' },
    });

    rerender({ value: 'y' });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});

describe('useThrottleCallback', () => {
  it('should invoke the callback immediately on first call (leading edge by default)', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottleCallback(fn, 500));

    act(() => {
      result.current('a');
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('should not invoke again within the throttle window', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottleCallback(fn, 500));

    act(() => {
      result.current('a');
      result.current('b');
      result.current('c');
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('should invoke once more on the trailing edge with the latest args', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottleCallback(fn, 500));

    act(() => {
      result.current('a');
      result.current('b');
      result.current('c');
    });

    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('should not invoke on the leading edge when leading is false', () => {
    const fn = vi.fn();
    const { result } = renderHook(() =>
      useThrottleCallback(fn, 500, { leading: false, trailing: true }),
    );

    act(() => {
      result.current('a');
    });

    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('should not invoke on the trailing edge when trailing is false', () => {
    const fn = vi.fn();
    const { result } = renderHook(() =>
      useThrottleCallback(fn, 500, { leading: true, trailing: false }),
    );

    act(() => {
      result.current('a');
      result.current('b');
    });

    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('should be a no-op when both leading and trailing are false', () => {
    const fn = vi.fn();
    const { result } = renderHook(() =>
      useThrottleCallback(fn, 500, { leading: false, trailing: false }),
    );

    act(() => {
      result.current('a');
      result.current('b');
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it('should allow another leading invocation after the window passes', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottleCallback(fn, 500));

    act(() => {
      result.current('a');
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    act(() => {
      result.current('b');
    });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });

  it('should pass multiple arguments correctly', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottleCallback(fn, 500));

    act(() => {
      result.current(1, 'two', { three: true });
    });

    expect(fn).toHaveBeenCalledWith(1, 'two', { three: true });
  });

  it('should always invoke the latest callback (no stale closures)', () => {
    const first = vi.fn();
    const second = vi.fn();

    const { result, rerender } = renderHook(({ cb }) => useThrottleCallback(cb, 500), {
      initialProps: { cb: first },
    });

    act(() => {
      result.current('a');
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    rerender({ cb: second });

    act(() => {
      result.current('b');
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith('b');
  });

  it('should keep a stable identity across renders when options do not change', () => {
    type Cb = (arg: string) => void;
    const initial: Cb = vi.fn();
    const { result, rerender } = renderHook(({ cb }: { cb: Cb }) => useThrottleCallback(cb, 500), {
      initialProps: { cb: initial },
    });

    const first = result.current;
    rerender({ cb: vi.fn() as Cb });
    rerender({ cb: vi.fn() as Cb });

    expect(result.current).toBe(first);
  });

  it('should produce a new function identity when delay changes', () => {
    const cb: (arg: string) => void = vi.fn();
    const { result, rerender } = renderHook(
      ({ delay }: { delay: number }) => useThrottleCallback(cb, delay),
      { initialProps: { delay: 500 } },
    );

    const first = result.current;
    rerender({ delay: 1000 });

    expect(result.current).not.toBe(first);
  });

  describe('.cancel()', () => {
    it('should drop the pending trailing invocation', () => {
      const fn = vi.fn();
      const { result } = renderHook(() => useThrottleCallback(fn, 500));

      act(() => {
        result.current('a');
        result.current('b');
      });
      expect(fn).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.cancel();
        vi.advanceTimersByTime(1000);
      });

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset the throttle window so the next call fires immediately', () => {
      const fn = vi.fn();
      const { result } = renderHook(() => useThrottleCallback(fn, 500));

      act(() => {
        result.current('a');
        result.current.cancel();
        result.current('b');
      });

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(1, 'a');
      expect(fn).toHaveBeenNthCalledWith(2, 'b');
    });
  });

  describe('.flush()', () => {
    it('should immediately invoke the pending trailing call', () => {
      const fn = vi.fn();
      const { result } = renderHook(() => useThrottleCallback(fn, 500));

      act(() => {
        result.current('a');
        result.current('b');
        result.current('c');
      });
      expect(fn).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.flush();
      });

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('c');
    });

    it('should be a no-op when there is no pending invocation', () => {
      const fn = vi.fn();
      const { result } = renderHook(() => useThrottleCallback(fn, 500));

      act(() => {
        result.current.flush();
      });

      expect(fn).not.toHaveBeenCalled();
    });

    it('should not trigger the trailing timer again after flush', () => {
      const fn = vi.fn();
      const { result } = renderHook(() => useThrottleCallback(fn, 500));

      act(() => {
        result.current('a');
        result.current('b');
        result.current.flush();
      });
      expect(fn).toHaveBeenCalledTimes(2);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  it('should cancel pending invocations on unmount', () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useThrottleCallback(fn, 500));

    act(() => {
      result.current('a');
      result.current('b');
    });
    expect(fn).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use the default delay (500ms) when none is provided', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottleCallback(fn));

    act(() => {
      result.current('a');
      result.current('b');
    });

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });
});
