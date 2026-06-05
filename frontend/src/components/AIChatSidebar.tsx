"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { postChat, type ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type Props = {
  board: BoardData;
  onBoardUpdate: (board: BoardData) => void;
};

export const AIChatSidebar = ({ board, onBoardUpdate }: Props) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await postChat(next, board);
      setMessages((prev) => [...prev, { role: "assistant", content: res.message }]);
      onBoardUpdate(res.board);
    } catch {
      setError("Unable to reach the AI. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[var(--stroke)] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
          AI Assistant
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--navy-dark)]">
          Ask me to manage your board
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-[var(--gray-text)] text-center mt-4">
            Try: &ldquo;Add a card called Design Review to In Progress&rdquo;
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--secondary-purple)] text-white"
                  : "bg-white border border-[var(--stroke)] text-[var(--navy-dark)]"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="[&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-1 [&_strong]:font-semibold [&_code]:bg-[var(--surface)] [&_code]:px-1 [&_code]:rounded">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-sm text-[var(--gray-text)]">
              Thinking...
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-[rgba(236,173,10,0.45)] bg-[rgba(236,173,10,0.12)] px-4 py-3 text-xs text-[var(--navy-dark)]">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--stroke)] p-4">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 resize-none rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-sm text-[var(--navy-dark)] placeholder-[var(--gray-text)] focus:border-[var(--primary-blue)] focus:outline-none"
            rows={2}
            placeholder="Message the AI assistant..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
