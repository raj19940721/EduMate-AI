"use client";

import { useState } from "react";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy answer:", error);
    }
  }

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-2xl rounded-2xl bg-black p-4 text-white"
            : "max-w-3xl rounded-2xl bg-white p-4 shadow-sm"
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <p className="font-semibold">{isUser ? "You" : "🤖 EduMate"}</p>

          {/* Copy button - EduMate answers only */}
          {!isUser && content.trim() && (
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label={copied ? "Answer copied" : "Copy answer"}
              title={copied ? "Copied" : "Copy answer"}
            >
              {copied ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="13" height="13" x="9" y="9" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Answer */}
        <p
          className={`mt-2 whitespace-pre-wrap leading-7 ${
            isUser ? "text-white" : "text-slate-700"
          }`}
        >
          {content}
        </p>
      </div>
    </div>
  );
}
