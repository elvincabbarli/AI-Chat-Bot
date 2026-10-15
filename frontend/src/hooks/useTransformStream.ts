import { useCallback, useEffect, useRef, useState } from "react";
import { streamTransform } from "../api/stream";
import type { TransformMode } from "../types/chat";

export function useTransformStream() {
  const [resultText, setResultText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const running = useRef(false);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      ++version.current;
      cancelRef.current?.();
      running.current = false;
    },
    [],
  );
  const run = useCallback((mode: TransformMode, text: string) => {
    if (running.current) return;
    running.current = true;
    const current = ++version.current;
    setResultText("");
    setError(null);
    setIsStreaming(true);
    let accumulated = "";
    const finish = (failed: boolean, error?: unknown) => {
      if (current !== version.current) return;
      running.current = false;
      setIsStreaming(false);
      cancelRef.current = null;
      if (failed)
        setError(
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
        );
    };
    void streamTransform(mode, text, {
      onChunk: (chunk) => {
        if (current === version.current) {
          accumulated += chunk;
          setResultText(accumulated);
        }
      },
      onDone: () => finish(false),
      onError: (error) => finish(true, error),
    })
      .then((cancel) => {
        if (current !== version.current || !running.current) cancel();
        else cancelRef.current = cancel;
      })
      .catch(() => finish(true));
  }, []);
  const cancel = useCallback(() => {
    ++version.current;
    cancelRef.current?.();
    cancelRef.current = null;
    running.current = false;
    setIsStreaming(false);
  }, []);
  return { resultText, isStreaming, error, run, cancel };
}
