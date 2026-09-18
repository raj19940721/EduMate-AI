import MessageBubble from "./MessageBubble";
import type { Message } from "@/types";

interface ChatWindowProps {
  messages: Message[];
  loading: boolean;
}

export default function ChatWindow({ messages, loading }: ChatWindowProps) {
  return (
    <div className="flex w-full flex-col space-y-5 px-4 py-5 sm:px-6 sm:py-6">
      {/* Empty state */}
      {messages.length === 0 && (
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
              🤖
            </div>

            <h2 className="mt-4 text-xl font-bold text-slate-900">
              Hi! I'm EduMate 👋
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 sm:text-base">
              I'm here to help you learn, practice and understand your homework.
              Ask me anything!
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                📚 Learn
              </span>
              <span className="rounded-full bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700">
                🧠 Practice
              </span>
              <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
                ✨ Understand
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Conversation */}
      {messages.length > 0 && (
        <div className="flex flex-col space-y-5">
          {messages.map((message, index) => (
            <MessageBubble
              key={`${message.role}-${index}`}
              role={message.role}
              content={message.content}
            />
          ))}
        </div>
      )}

      {/* Thinking state */}
      {loading && (
        <div className="flex justify-start">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-base">🤔</span>
              <span>EduMate is thinking...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
