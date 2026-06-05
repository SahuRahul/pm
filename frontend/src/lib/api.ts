import type { BoardData } from "@/lib/kanban";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export const apiUrl = (path: string) => `${API_BASE}${path}`;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatResponse = { message: string; board: BoardData };

export async function postChat(
  messages: ChatMessage[],
  board: BoardData
): Promise<ChatResponse> {
  const res = await fetch(apiUrl("/api/ai/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ messages, board }),
  });
  if (!res.ok) throw new Error("AI request failed");
  return res.json() as Promise<ChatResponse>;
}
