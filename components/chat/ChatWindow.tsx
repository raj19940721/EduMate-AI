import MessageBubble from "./MessageBubble";
import type { Message } from "@/types";

interface ChatWindowProps {
  messages: Message[];
  loading: boolean;
}

export default function ChatWindow({ messages, loading }: ChatWindowProps) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-6">
      {messages.length === 0 && (
        <div className="flex justify-start">
          <div className="max-w-xl rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-semibold">🤖 EduMate</p>

            <p className="mt-2 text-gray-700">
              Hi! 👋 I'm EduMate. What would you like to learn today?
            </p>
          </div>
        </div>
      )}

      {messages.map((message, index) => (
        <MessageBubble
          key={index}
          role={message.role}
          content={message.content}
        />
      ))}

      {loading && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            🤔 EduMate is thinking...
          </div>
        </div>
      )}
    </div>
  );
}
