import type { BoardData, BoardSummary, Label, Priority } from "@/lib/kanban";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export const apiUrl = (path: string) => `${API_BASE}${path}`;

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatResponse = { message: string; board: BoardData };
export type UserInfo = { username: string; email: string | null; role: string };

// --- Auth ---

export async function postLogin(username: string, password: string): Promise<void> {
  const res = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
}

export async function postRegister(
  username: string,
  password: string,
  email?: string
): Promise<void> {
  const res = await fetch(apiUrl("/api/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password, email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? "Registration failed");
  }
}

export async function postLogout(): Promise<void> {
  await fetch(apiUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include",
  });
}

export async function getMe(): Promise<UserInfo> {
  const res = await fetch(apiUrl("/api/auth/me"), { credentials: "include" });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json() as Promise<UserInfo>;
}

// --- Boards ---

export async function listBoards(): Promise<BoardSummary[]> {
  const res = await fetch(apiUrl("/api/boards"), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to list boards");
  return res.json() as Promise<BoardSummary[]>;
}

export async function getBoard(boardId: string): Promise<BoardData> {
  const res = await fetch(apiUrl(`/api/boards/${boardId}`), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load board");
  return res.json() as Promise<BoardData>;
}

export async function createBoard(name: string, description?: string): Promise<{ id: string; name: string }> {
  const res = await fetch(apiUrl("/api/boards"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, description: description ?? "" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? "Failed to create board");
  }
  return res.json() as Promise<{ id: string; name: string }>;
}

export async function updateBoard(
  boardId: string,
  updates: { name?: string; description?: string }
): Promise<{ id: string; name: string; description: string }> {
  const res = await fetch(apiUrl(`/api/boards/${boardId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update board");
  return res.json() as Promise<{ id: string; name: string; description: string }>;
}

export async function deleteBoard(boardId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/boards/${boardId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? "Failed to delete board");
  }
}

export async function reorderColumns(boardId: string, columnIds: number[]): Promise<void> {
  const res = await fetch(apiUrl(`/api/boards/${boardId}/reorder-columns`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ columnIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder columns");
}

// --- Columns ---

export async function createColumn(
  boardId: number,
  title: string,
  color?: string
): Promise<{ id: string; title: string; color: string; cardIds: string[] }> {
  const res = await fetch(apiUrl("/api/columns"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ boardId, title, color: color ?? "#ecad0a" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? "Failed to create column");
  }
  return res.json() as Promise<{ id: string; title: string; color: string; cardIds: string[] }>;
}

export async function updateColumn(
  columnId: string,
  updates: { title?: string; color?: string }
): Promise<{ id: string; title: string; color: string }> {
  const res = await fetch(apiUrl(`/api/columns/${columnId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update column");
  return res.json() as Promise<{ id: string; title: string; color: string }>;
}

export async function deleteColumn(columnId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/columns/${columnId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? "Failed to delete column");
  }
}

// --- Cards ---

export async function createCard(
  columnId: number,
  title: string,
  details?: string,
  priority?: Priority,
  dueDate?: string
): Promise<{ id: string; title: string; details: string; priority: Priority; dueDate: string | null }> {
  const res = await fetch(apiUrl("/api/cards"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ columnId, title, details, priority: priority ?? "medium", dueDate }),
  });
  if (!res.ok) throw new Error("Failed to create card");
  return res.json();
}

export async function updateCard(
  cardId: string,
  updates: { title?: string; details?: string; priority?: Priority; dueDate?: string | null }
): Promise<{ id: string; title: string; details: string; priority: Priority; dueDate: string | null }> {
  const res = await fetch(apiUrl(`/api/cards/${cardId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update card");
  return res.json();
}

export async function deleteCard(cardId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/cards/${cardId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete card");
}

export async function moveCardApi(
  cardId: string,
  columnId: number,
  position: number
): Promise<void> {
  const res = await fetch(apiUrl(`/api/cards/${cardId}/move`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ columnId, position }),
  });
  if (!res.ok) throw new Error("Failed to move card");
}

// --- Labels ---

export async function listLabels(): Promise<Label[]> {
  const res = await fetch(apiUrl("/api/labels"), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to list labels");
  return res.json() as Promise<Label[]>;
}

export async function createLabel(name: string, color: string): Promise<Label> {
  const res = await fetch(apiUrl("/api/labels"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, color }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? "Failed to create label");
  }
  return res.json() as Promise<Label>;
}

export async function updateLabelApi(
  labelId: string,
  updates: { name?: string; color?: string }
): Promise<Label> {
  const res = await fetch(apiUrl(`/api/labels/${labelId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update label");
  return res.json() as Promise<Label>;
}

export async function deleteLabelApi(labelId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/labels/${labelId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete label");
}

export async function assignLabel(cardId: string, labelId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/cards/${cardId}/labels/${labelId}`), {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to assign label");
}

export async function unassignLabel(cardId: string, labelId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/cards/${cardId}/labels/${labelId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to unassign label");
}

// --- Comments ---

export type Comment = { id: string; body: string; author: string; createdAt: string };

export async function listComments(cardId: string): Promise<Comment[]> {
  const res = await fetch(apiUrl(`/api/cards/${cardId}/comments`), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to list comments");
  return res.json() as Promise<Comment[]>;
}

export async function createComment(cardId: string, body: string): Promise<Comment> {
  const res = await fetch(apiUrl(`/api/cards/${cardId}/comments`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error("Failed to create comment");
  return res.json() as Promise<Comment>;
}

export async function deleteComment(commentId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/comments/${commentId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete comment");
}

// --- Profile ---

export async function updateProfile(updates: { email?: string; password?: string; currentPassword?: string }): Promise<{ username: string; email: string | null; role: string }> {
  const res = await fetch(apiUrl("/api/auth/me"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? "Failed to update profile");
  }
  return res.json();
}

// --- AI ---

export async function postChat(
  messages: ChatMessage[],
  board: BoardData,
  boardId?: string
): Promise<ChatResponse> {
  const res = await fetch(apiUrl("/api/ai/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ messages, board, boardId: boardId ? parseInt(boardId) : null }),
  });
  if (!res.ok) throw new Error("AI request failed");
  return res.json() as Promise<ChatResponse>;
}
