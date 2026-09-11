interface ChatInputProps {
  question: string;
  loading: boolean;
  onQuestionChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ChatInput({
  question,
  loading,
  onQuestionChange,
  onSubmit,
}: ChatInputProps) {
  return (
    <div className="border-t bg-white p-4">
      <form onSubmit={onSubmit} className="flex gap-3">
        <input
          type="text"
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder="Ask EduMate a question..."
          className="flex-1 rounded-xl border px-4 py-3 outline-none focus:ring-2"
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-black px-6 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>
    </div>
  );
}
