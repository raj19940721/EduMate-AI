interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-xl rounded-2xl bg-black p-4 text-white"
            : "max-w-xl rounded-2xl bg-white p-4 shadow-sm"
        }
      >
        <p className="font-semibold">{isUser ? "You" : "🤖 EduMate"}</p>

        <p className="mt-2 whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
