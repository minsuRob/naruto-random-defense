import { useRef } from 'react';

const EMPTY = Symbol('empty');

/**
 * Create a value once per component instance and never recompute it.
 *
 * `useMemo` is a caching *hint* — React may drop and recompute it, and with the
 * React Compiler and StrictMode double-rendering it demonstrably does. That is
 * fine for derived data and fatal for objects that own identity: the effect
 * would attach listeners to one instance while the render tree uses another.
 */
export function useConstant<T>(factory: () => T): T {
  const ref = useRef<T | typeof EMPTY>(EMPTY);
  if (ref.current === EMPTY) ref.current = factory();
  return ref.current as T;
}
