"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import ChatWindow from "@/components/chat/ChatWindow";
import ChatInput from "@/components/chat/ChatInput";
import ConversationSidebar from "@/components/chat/ConversationSidebar";
import type { Message, StudentProfile } from "@/types";
import QuizCard from "@/components/chat/QuizCard";
import LearningRecommendation from "@/components/chat/LearningRecommendation";
import SmartReview from "@/components/chat/SmartReview";
import StudyPlan from "@/components/chat/StudyPlan";
import StudyMode from "@/components/chat/StudyMode";

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export default function ChatPage() {
  const router = useRouter();

  const [student, setStudent] = useState<StudentProfile | null>(null);

  const [question, setQuestion] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);

  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [conversationId, setConversationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Load authenticated user + student + conversations + current conversation + messages
  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createSupabaseBrowserClient();

        // --------------------------------
        // 0. Verify authenticated user
        // --------------------------------
        const { data: { user }, error: authError } =
          await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        setUserEmail(user.email ?? null);

        // --------------------------------
        // 1. Load student
        // --------------------------------
        const studentResponse = await fetch("/api/student");

        if (!studentResponse.ok) {
          if (studentResponse.status === 401) {
            await supabase.auth.signOut();
            router.replace("/login");
            return;
          }

          throw new Error("Failed to load student");
        }

        const studentData = await studentResponse.json();

        setStudent(studentData.student);

        // --------------------------------
        // 2. Load all conversations
        // --------------------------------
        const conversationsResponse = await fetch("/api/conversation");

        if (!conversationsResponse.ok) {
          throw new Error("Failed to load conversations");
        }

        const conversationsData = await conversationsResponse.json();

        const loadedConversations = conversationsData.conversations ?? [];

        setConversations(loadedConversations);

        // --------------------------------
        // 3. Select latest conversation
        // --------------------------------
        if (loadedConversations.length === 0) {
          return;
        }

        const currentConversation = loadedConversations[0];

        const currentConversationId = currentConversation.id;

        setConversationId(currentConversationId);

        console.log("Conversation ID:", currentConversationId);

        // --------------------------------
        // 4. Load messages
        // --------------------------------
        const messagesResponse = await fetch(
          `/api/messages?conversationId=${currentConversationId}`,
        );

        if (!messagesResponse.ok) {
          throw new Error("Failed to load messages");
        }

        const messagesData = await messagesResponse.json();

        setMessages(messagesData.messages ?? []);
      } catch (error) {
        console.error("Failed to load chat data:", error);
      } finally {
        setAuthLoading(false);
      }
    };

    loadData();
  }, [router]);

  // --------------------------------
  // Create new conversation
  // --------------------------------
  const handleNewChat = async () => {
    try {
      const response = await fetch("/api/conversation", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to create conversation");
      }

      const data = await response.json();

      const newConversation = data.conversation;

      // Add new conversation to sidebar
      setConversations((previous) => [newConversation, ...previous]);

      // Make it active
      setConversationId(newConversation.id);

      // Clear current messages
      setMessages([]);

      // Clear input
      setQuestion("");
    } catch (error) {
      console.error("New chat error:", error);
    }
  };

  // --------------------------------
  // Select existing conversation
  // --------------------------------
  const handleSelectConversation = async (selectedConversationId: string) => {
    try {
      setConversationId(selectedConversationId);

      setLoading(true);

      const response = await fetch(
        `/api/messages?conversationId=${selectedConversationId}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load conversation messages");
      }

      const data = await response.json();

      setMessages(data.messages ?? []);

      // Clear input when switching chat
      setQuestion("");
    } catch (error) {
      console.error("Conversation selection error:", error);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------
  // Send message
  // --------------------------------
  const sendMessage = async (messageText: string) => {
    if (!student || !conversationId) {
      return;
    }

    const currentQuestion = messageText.trim();

    if (!currentQuestion || loading) {
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: currentQuestion,
    };

    const updatedMessages = [...messages, userMessage];

    // Show user message + empty assistant message
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
          conversationId,
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

      // Refresh conversation list
      // so updated_at ordering stays current
      const conversationsResponse = await fetch("/api/conversation");

      if (conversationsResponse.ok) {
        const conversationsData = await conversationsResponse.json();

        setConversations(conversationsData.conversations ?? []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim() || loading) {
      return;
    }

    await sendMessage(question);
  };

  // --------------------------------
  // Study Plan → Practice / AI Tutor
  // --------------------------------
  useEffect(() => {
    const handlePracticeStart = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        topic?: string;
        studyPlanId?: string;
      }>;

      const topic = customEvent.detail?.topic?.trim();

      if (!topic) {
        return;
      }

      const practicePrompt =
        `Let's practice ${topic}. ` +
        `Please help me practice this topic with simple, age-appropriate questions and examples. ` +
        `Ask me one question at a time and wait for my answer before continuing.`;

      console.log("Starting Study Plan practice:", {
        topic,
        studyPlanId: customEvent.detail?.studyPlanId,
      });

      setQuestion("");

      window.setTimeout(() => {
        void sendMessage(practicePrompt);
      }, 0);
    };

    window.addEventListener(
      "edumate:start-practice",
      handlePracticeStart,
    );

    return () => {
      window.removeEventListener(
        "edumate:start-practice",
        handlePracticeStart,
      );
    };
  }, [student, conversationId, messages, loading]);

  // --------------------------------
  // Study Plan → Review / AI Tutor
  // --------------------------------
  useEffect(() => {
    const handleReviewStart = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        topic?: string;
        studyPlanId?: string;
      }>;

      const topic = customEvent.detail?.topic?.trim();

      if (!topic) {
        return;
      }

      const reviewPrompt =
        `Let's review ${topic}. ` +
        `Give me a simple, age-appropriate review of this topic using the student's learning context and relevant educational knowledge. ` +
        `Start with the key ideas, then give a few short review questions one at a time and wait for my answer. ` +
        `Do not make it too difficult.`;

      console.log("Starting Study Plan review:", {
        topic,
        studyPlanId: customEvent.detail?.studyPlanId,
      });

      setQuestion("");

      window.setTimeout(() => {
        void sendMessage(reviewPrompt);
      }, 0);
    };

    window.addEventListener(
      "edumate:start-review",
      handleReviewStart,
    );

    return () => {
      window.removeEventListener(
        "edumate:start-review",
        handleReviewStart,
      );
    };
  }, [student, conversationId, messages, loading]);

  // --------------------------------
  // Logout
  // --------------------------------
  const handleLogout = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleDeleteConversation = async (conversationToDeleteId: string) => {
    try {
      const response = await fetch(
        `/api/conversation?conversationId=${conversationToDeleteId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = await response.json();

        throw new Error(data.error || "Failed to delete conversation");
      }

      // Remove from sidebar
      setConversations((previous) =>
        previous.filter(
          (conversation) => conversation.id !== conversationToDeleteId,
        ),
      );

      // If deleting active conversation
      if (conversationId === conversationToDeleteId) {
        setMessages([]);

        // Find another conversation
        const remaining = conversations.filter(
          (conversation) => conversation.id !== conversationToDeleteId,
        );

        if (remaining.length > 0) {
          await handleSelectConversation(remaining[0].id);
        } else {
          // No conversations left
          const response = await fetch("/api/conversation", {
            method: "POST",
          });

          if (response.ok) {
            const data = await response.json();

            const newConversation = data.conversation;

            setConversations([newConversation]);
            setConversationId(newConversation.id);
            setMessages([]);
          }
        }
      }
    } catch (error) {
      console.error("Delete conversation error:", error);
    }
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-2xl bg-white px-6 py-5 text-center shadow-sm">
          <div className="text-lg font-semibold text-gray-900">
            Loading EduMate...
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Checking your account
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen bg-gray-50">
      {/* -------------------------------- */}
      {/* Conversation Sidebar */}
      {/* -------------------------------- */}

      <ConversationSidebar
        conversations={conversations}
        activeConversationId={conversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      {/* -------------------------------- */}
      {/* Main Chat Area */}
      {/* -------------------------------- */}

      <section className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="border-b bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">EduMate AI</h1>

              <p className="text-sm text-gray-500">
                Your friendly AI learning companion
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gray-100 px-4 py-2 text-sm">
                {student
                  ? `${student.name} · Grade ${student.grade}`
                  : "Loading profile..."}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                title={userEmail ?? "Sign out"}
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Chat messages */}
        <div className="min-h-[250px] flex-1 overflow-y-auto">
          <ChatWindow messages={messages} loading={loading} />
        </div>

        {/* Learning Features */}
        <div className="shrink-0 overflow-y-auto">
          <SmartReview />

          <LearningRecommendation />

          <StudyPlan />

          <StudyMode />

          {/* Quiz */}
          <div className="border-t bg-white px-6 py-4">
            <QuizCard />
          </div>
        </div>

        {/* Chat input */}
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
