import { useCallback, useEffect, useRef, useState } from "react";

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const storedValueRef = useRef(storedValue);
  const initialValueRef = useRef(initialValue);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCallbackRef = useRef<number | null>(null);

  const persist = useCallback((valueToStore: T) => {
    if (typeof window === "undefined") return;

    const write = () => {
      try {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        // Quota errors should not make the editor unusable.
        console.error(error);
      }
    };

    const requestIdleCallback = (window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }).requestIdleCallback;

    if (requestIdleCallback) {
      idleCallbackRef.current = requestIdleCallback(write, { timeout: 1000 });
    } else {
      persistTimerRef.current = setTimeout(write, 0);
    }
  }, [key]);

  const setValue = useCallback<React.Dispatch<React.SetStateAction<T>>>((value) => {
    const valueToStore = value instanceof Function ? value(storedValueRef.current) : value;
    storedValueRef.current = valueToStore;
    setStoredValue(valueToStore);

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    if (idleCallbackRef.current !== null) {
      const cancelIdleCallback = (window as Window & {
        cancelIdleCallback?: (handle: number) => void;
      }).cancelIdleCallback;
      cancelIdleCallback?.(idleCallbackRef.current);
      idleCallbackRef.current = null;
    }

    persist(valueToStore);
  }, [persist]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        const nextValue = e.newValue ? JSON.parse(e.newValue) : initialValueRef.current;
        storedValueRef.current = nextValue;
        setStoredValue(nextValue);
      } catch (error) {
        console.error(error);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      if (idleCallbackRef.current !== null) {
        const cancelIdleCallback = (window as Window & {
          cancelIdleCallback?: (handle: number) => void;
        }).cancelIdleCallback;
        cancelIdleCallback?.(idleCallbackRef.current);
      }
    };
  }, [key]);

  return [storedValue, setValue];
}

export default useLocalStorage;
