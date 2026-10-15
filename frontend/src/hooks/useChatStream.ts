import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat } from "../api/stream";

export function useChatStream(conversationId: string | null) {
  const [streamingText, setStreamingText] = useState("");
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const version = useRef(0);
  const running = useRef(false);

  useEffect(() => {
    ++version.current;
    running.current = false;
    setStreamingText("");
    setPendingPrompt("");
    setIsStreaming(false);
    setError(null);
    setNotice(null);
    return () => {
      ++version.current;
      cancelRef.current?.();
      cancelRef.current = null;
      running.current = false;
    };
  }, [conversationId]);

  const clearPreview = useCallback(() => {
    setPendingPrompt("");
    setStreamingText("");
    setNotice(null);
  }, []);

  const sendPrompt = useCallback(
    (prompt: string, onComplete: () => Promise<boolean>) => {
      if (!conversationId || running.current) return;
      running.current = true;
      const current = ++version.current;
      setPendingPrompt(prompt);
      setStreamingText("");
      setIsStreaming(true);
      setError(null);
      setNotice(null);
      let accumulated = "";
      const finish = () => {
        if (current !== version.current) return;
        running.current = false;
        setIsStreaming(false);
        cancelRef.current = null;
      };
      const fail = (error?: unknown) => {
        if (current !== version.current) return;
        setError(
          error instanceof Error
            ? error.message
            : "No response was received. You can send the message again.",
        );
        finish();
      };
      void streamChat(conversationId, prompt, {
        onChunk: (chunk) => {
          if (current !== version.current) return;
          accumulated += chunk;
          setStreamingText(accumulated);
        },
        onDone: () => {
          if (current !== version.current) return;
          void (async () => {
            try {
              const refreshed = await onComplete();
              if (current !== version.current) return;
              if (refreshed) clearPreview();
              else
                setError(
                  "The response was saved, but history could not be refreshed. Click Refresh.",
                );
            } catch {
              if (current === version.current)
                setError("History could not be refreshed. Please try again.");
            } finally {
              finish();
            }
          })();
        },
        onError: fail,
      })
        .then((cancel) => {
          if (current !== version.current || !running.current) cancel();
          else cancelRef.current = cancel;
        })
        .catch(fail);
    },
    [conversationId, clearPreview],
  );

  const cancel = useCallback(() => {
    ++version.current;
    cancelRef.current?.();
    cancelRef.current = null;
    running.current = false;
    setIsStreaming(false);
    setNotice(
      "The response was stopped. Refresh history to view the saved portion.",
    );
  }, []);

  return {
    streamingText,
    pendingPrompt,
    isStreaming,
    error,
    notice,
    sendPrompt,
    cancel,
    clearPreview,
  };
}
