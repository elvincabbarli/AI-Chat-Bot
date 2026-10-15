import { API_BASE_URL, getAccessToken } from "./client";
import type { TransformMode } from "../types/chat";

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: unknown) => void;
}

async function buildStreamUrl(
  path: string,
  params: Record<string, string>,
): Promise<string> {
  const token = await getAccessToken();
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  if (token) {
    url.searchParams.set("access_token", token);
  }
  return url.toString();
}

function connect(url: string, callbacks: StreamCallbacks): () => void {
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    callbacks.onChunk(event.data as string);
  };

  eventSource.addEventListener("done", () => {
    eventSource.close();
    callbacks.onDone();
  });

  eventSource.addEventListener("failure", (event) => {
    eventSource.close();
    callbacks.onError(new Error((event as MessageEvent).data));
  });

  eventSource.onerror = (event) => {
    eventSource.close();
    callbacks.onError(event);
  };

  return () => eventSource.close();
}

export async function streamChat(
  conversationId: string,
  prompt: string,
  callbacks: StreamCallbacks,
): Promise<() => void> {
  const url = await buildStreamUrl("/chat/stream", { conversationId, prompt });
  return connect(url, callbacks);
}

export async function streamTransform(
  mode: TransformMode,
  text: string,
  callbacks: StreamCallbacks,
): Promise<() => void> {
  const url = await buildStreamUrl("/chat/transform", { mode, text });
  return connect(url, callbacks);
}
