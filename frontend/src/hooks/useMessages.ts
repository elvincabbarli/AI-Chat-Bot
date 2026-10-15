import { useCallback, useEffect, useRef, useState } from 'react';
import { getMessages } from '../api/chat';
import type { ChatMessage } from '../types/chat';

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async (): Promise<boolean> => {
    requestRef.current?.abort();
    if (!conversationId) {
      setMessages([]);
      return true;
    }
    const request = new AbortController();
    requestRef.current = request;
    setLoading(true);
    setError(null);
    try {
      const data = await getMessages(conversationId, request.signal);
      if (request.signal.aborted) return false;
      setMessages(data);
      return true;
    } catch {
      if (!request.signal.aborted)
        setError('Messages could not be loaded. Please try again.');
      return false;
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    void refresh();
    return () => requestRef.current?.abort();
  }, [refresh]);

  return { messages, loading, error, refresh };
}
