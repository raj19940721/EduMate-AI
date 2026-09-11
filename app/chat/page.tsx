"use client";

import { useState } from "react";
import ChatWindow from "@/components/chat/ChatWindow";
import ChatInput from "@/components/chat/ChatInput";
import type { Message, StudentProfile } from "@/types";

export default function ChatPage() {
  const student: StudentProfile = {
    name: "Raja",
    grade: 2,
  };
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim() || loading) return;

    const currentQuestion = question.trim();

    const userMessage: Message = {
      role: "user",
      content: currentQuestion,
    };

    const updatedMessages = [...messages, userMessage];

    setMessages([
      ...updatedMessages,
      {
        role: "assistant",
        content: "",
      },
    ]);

    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages,
          student,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        throw new Error(errorData.error || "Something went wrong");
      }

      if (!response.body) {
        throw new Error("Response body is empty");
      }

      const reader = response.body.getReader();

      const decoder = new TextDecoder();

      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, {
          stream: true,
        });

        assistantText += chunk;

        setMessages([
          ...updatedMessages,
          {
            role: "assistant",
            content: assistantText,
          },
        ]);
      }
    } catch (error) {
      console.error(error);

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "Sorry, I couldn't answer that question.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">EduMate AI</h1>

            <p className="text-sm text-gray-500">
              Your friendly AI learning companion
            </p>
          </div>

          <div className="rounded-lg bg-gray-100 px-4 py-2 text-sm">
            {student.name} · Grade {student.grade}
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-81px)] max-w-5xl flex-col">
        <ChatWindow messages={messages} loading={loading} />

        <ChatInput
          question={question}
          loading={loading}
          onQuestionChange={setQuestion}
          onSubmit={handleSubmit}
        />
      </section>
    </main>
  );
}
