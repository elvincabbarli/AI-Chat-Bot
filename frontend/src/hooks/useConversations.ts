import { useCallback, useEffect, useRef, useState } from "react";
import {
  createConversation,
  deleteConversation,
  listConversations,
  renameConversation,
} from "../api/chat";
import type { Conversation } from "../types/chat";

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const mounted = useRef(false);
  const actionRef = useRef(false);

  const refresh = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    setError(null);
    try {
      const data = await listConversations();
      if (mounted.current && current === version.current)
        setConversations(data);
    } catch {
      if (mounted.current && current === version.current)
        setError("Conversations could not be loaded. Please try again.");
    } finally {
      if (mounted.current && current === version.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      ++version.current;
    };
  }, [refresh]);

  const mutate = useCallback(
    async <T>(action: () => Promise<T>): Promise<T | null> => {
      if (actionRef.current) return null;
      actionRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const result = await action();
        if (mounted.current) await refresh();
        return result;
      } catch {
        if (mounted.current) setError("The operation failed. Please try again.");
        return null;
      } finally {
        actionRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [refresh],
  );

  const createNew = () =>
    mutate(async () => (await createConversation()).conversationId);
  const rename = (id: string, title: string) =>
    mutate(async () => {
      await renameConversation(id, title);
      return true;
    });
  const remove = (id: string) =>
    mutate(async () => {
      await deleteConversation(id);
      if (mounted.current)
        setConversations((items) => items.filter((item) => item.id !== id));
      return true;
    });
  return {
    conversations,
    loading,
    busy,
    error,
    refresh,
    createNew,
    rename,
    remove,
  };
}
