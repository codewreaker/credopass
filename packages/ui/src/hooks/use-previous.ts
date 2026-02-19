import { useEffect, useRef } from 'react';

/**
 * Custom hook that stores the previous value of a state or prop.
 * Useful for comparing current vs previous values in effects or renders.
 * 
 * @param value - The current value to track
 * @returns The previous value
 * 
 * @example
 * const [count, setCount] = useState(0);
 * const prevCount = usePrevious(count);
 * 
 * useEffect(() => {
 *   console.log(`Count changed from ${prevCount} to ${count}`);
 * }, [count]);
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  // eslint-disable-next-line react-hooks/refs
  return ref.current;
}

export default usePrevious;
