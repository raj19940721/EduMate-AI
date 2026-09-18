"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import VoiceTutor from "@/components/chat/VoiceTutor";
import HomeworkHelper from "@/components/chat/HomeworkHelper";
import LanguageSelector from "@/components/LanguageSelector";

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export default function ChatPage() {
  const router = useRouter();

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [activeLearningFeature, setActiveLearningFeature] = useState<
    | "review"
    | "recommendation"
    | "study-plan"
    | "study-mode"
    | "quiz"
    | "voice"
    | "homework"
    | null
  >(null);

  // =========================================================
  // Load user, student, conversations and latest messages
  // =========================================================

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createSupabaseBrowserClient();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        setUserEmail(user.email ?? null);

        const studentResponse = await fetch("/api/student", {
          credentials: "include",
          cache: "no-store",
        });

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
        setPreferredLanguage(studentData.student?.preferred_language ?? "en");

        const conversationsResponse = await fetch("/api/conversation", {
          credentials: "include",
          cache: "no-store",
        });

        if (!conversationsResponse.ok) {
          throw new Error("Failed to load conversations");
        }

        const conversationsData = await conversationsResponse.json();
        const loadedConversations = conversationsData.conversations ?? [];

        setConversations(loadedConversations);

        if (loadedConversations.length === 0) {
          return;
        }

        const latestConversation = loadedConversations[0];
        setConversationId(latestConversation.id);

        const messagesResponse = await fetch(
          `/api/messages?conversationId=${latestConversation.id}`,
          {
            credentials: "include",
            cache: "no-store",
          },
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

    void loadData();
  }, [router]);

  // =========================================================
  // New chat
  // =========================================================

  const handleNewChat = async () => {
    if (loading) {
      return;
    }

    try {
      const response = await fetch("/api/conversation", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to create conversation");
      }

      const data = await response.json();
      const newConversation = data.conversation;

      setConversations((previous) => [
        newConversation,
        ...previous.filter(
          (conversation) => conversation.id !== newConversation.id,
        ),
      ]);

      setConversationId(newConversation.id);
      setMessages([]);
      setQuestion("");
    } catch (error) {
      console.error("New chat error:", error);
    }
  };

  // =========================================================
  // Select conversation
  // =========================================================

  const handleSelectConversation = async (selectedConversationId: string) => {
    if (loading) {
      return;
    }

    try {
      setConversationId(selectedConversationId);
      setLoading(true);

      const response = await fetch(
        `/api/messages?conversationId=${selectedConversationId}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load conversation messages");
      }

      const data = await response.json();

      setMessages(data.messages ?? []);
      setQuestion("");
    } catch (error) {
      console.error("Conversation selection error:", error);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // Send message
  // =========================================================

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
        credentials: "include",
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
        let errorMessage = "Something went wrong";

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Keep generic error.
        }

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("Response body is empty");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        assistantText += decoder.decode(value, {
          stream: true,
        });

        setMessages([
          ...updatedMessages,
          {
            role: "assistant",
            content: assistantText,
          },
        ]);
      }

      const conversationsResponse = await fetch("/api/conversation", {
        credentials: "include",
        cache: "no-store",
      });

      if (conversationsResponse.ok) {
        const conversationsData = await conversationsResponse.json();

        setConversations(conversationsData.conversations ?? []);
      }
    } catch (error) {
      console.error("Chat error:", error);

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "Sorry, I couldn't answer that question. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!question.trim() || loading) {
      return;
    }

    await sendMessage(question);
  };

  // =========================================================
  // Study Plan → Practice
  // =========================================================

  useEffect(() => {
    const handlePracticeStart = (event: Event) => {
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

      setQuestion("");

      window.setTimeout(() => {
        void sendMessage(practicePrompt);
      }, 0);
    };

    window.addEventListener("edumate:start-practice", handlePracticeStart);

    return () => {
      window.removeEventListener("edumate:start-practice", handlePracticeStart);
    };
  }, [student, conversationId, messages, loading]);

  // =========================================================
  // Study Plan → Review
  // =========================================================

  useEffect(() => {
    const handleReviewStart = (event: Event) => {
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

      setQuestion("");

      window.setTimeout(() => {
        void sendMessage(reviewPrompt);
      }, 0);
    };

    window.addEventListener("edumate:start-review", handleReviewStart);

    return () => {
      window.removeEventListener("edumate:start-review", handleReviewStart);
    };
  }, [student, conversationId, messages, loading]);

  // =========================================================
  // Logout
  // =========================================================

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

  // =========================================================
  // Delete conversation
  // =========================================================

  const handleDeleteConversation = async (conversationToDeleteId: string) => {
    try {
      const response = await fetch(
        `/api/conversation?conversationId=${conversationToDeleteId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!response.ok) {
        const data = await response.json();

        throw new Error(data.error || "Failed to delete conversation");
      }

      const remaining = conversations.filter(
        (conversation) => conversation.id !== conversationToDeleteId,
      );

      setConversations(remaining);

      if (conversationId !== conversationToDeleteId) {
        return;
      }

      setMessages([]);
      setQuestion("");

      if (remaining.length > 0) {
        await handleSelectConversation(remaining[0].id);
        return;
      }

      const createResponse = await fetch("/api/conversation", {
        method: "POST",
        credentials: "include",
      });

      if (createResponse.ok) {
        const data = await createResponse.json();
        const newConversation = data.conversation;

        setConversations([newConversation]);
        setConversationId(newConversation.id);
        setMessages([]);
      }
    } catch (error) {
      console.error("Delete conversation error:", error);
    }
  };

  // =========================================================
  // Loading
  // =========================================================

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
          <div className="text-xl font-bold text-slate-900">
            Loading EduMate...
          </div>

          <p className="mt-2 text-sm text-slate-500">
            Getting your learning space ready
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // Page
  // =========================================================

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="z-30 shrink-0 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl shadow-sm">
              🎓
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                EduMate AI
              </h1>

              <p className="hidden text-xs text-slate-500 sm:block">
                Your friendly AI learning companion
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
              {student ? `${student.name} · Grade ${student.grade}` : "Student"}
            </div>

            <LanguageSelector
              value={preferredLanguage}
              onChange={setPreferredLanguage}
            />

            <button
              type="button"
              onClick={handleNewChat}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
            >
              + New
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title={userEmail ?? "Sign out"}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <span className="hidden sm:inline">Sign Out</span>
              <span className="sm:hidden">Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1">
        {/* Conversation sidebar */}
        <aside className="hidden shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <ConversationSidebar
            conversations={conversations}
            activeConversationId={conversationId}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
          />
        </aside>

        {/* Main content */}
        <section className="flex min-w-0 min-h-0 flex-1 flex-col">
          {/* AI Tutor */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
              <div className="flex w-full items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    AI Tutor
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                    What would you like to learn?
                  </h2>
                </div>

                <div className="hidden rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:block">
                  🎓 Grade {student?.grade ?? "-"}
                </div>
              </div>
            </div>

            <ChatWindow messages={messages} loading={loading} />

            {/* Learning Center */}
            <section className="border-t border-slate-200 bg-white">
              <div className="w-full">
                <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        📚 My Learning
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Choose a tool when you need it. Your progress is saved
                        automatically.
                      </p>
                    </div>

                    {student && (
                      <div className="hidden rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:block">
                        Grade {student.grade}
                      </div>
                    )}
                  </div>
                </div>

                {/* Feature picker */}
                <div className="grid gap-3 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    {
                      id: "review" as const,
                      icon: "🔄",
                      title: "Smart Review",
                      description: "Review topics that need attention",
                    },
                    {
                      id: "recommendation" as const,
                      icon: "🎯",
                      title: "Learning Recommendation",
                      description: "See what to learn next",
                    },
                    {
                      id: "study-plan" as const,
                      icon: "🗓️",
                      title: "Personal Study Plan",
                      description: "Follow your personalized 7-day plan",
                    },
                    {
                      id: "study-mode" as const,
                      icon: "📚",
                      title: "Study Mode",
                      description: "Learn a topic step by step",
                    },
                    {
                      id: "quiz" as const,
                      icon: "🧠",
                      title: "Practice Quiz",
                      description: "Test what you've learned",
                    },
                    {
                      id: "voice" as const,
                      icon: "🎙️",
                      title: "Voice Tutor",
                      description: "Talk to EduMate using your voice",
                    },
                    {
                      id: "homework" as const,
                      icon: "📝",
                      title: "Homework Helper",
                      description: "Get step-by-step homework help",
                    },
                  ].map((feature) => {
                    const isActive = activeLearningFeature === feature.id;

                    return (
                      <button
                        key={feature.id}
                        type="button"
                        onClick={() =>
                          setActiveLearningFeature(isActive ? null : feature.id)
                        }
                        aria-expanded={isActive}
                        className={[
                          "group flex min-h-[92px] w-full items-center justify-between rounded-2xl border bg-white p-4 text-left shadow-sm transition",
                          isActive
                            ? "border-blue-500 ring-2 ring-blue-100"
                            : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
                        ].join(" ")}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={[
                              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl transition",
                              isActive
                                ? "bg-blue-50"
                                : "bg-slate-50 group-hover:bg-blue-50",
                            ].join(" ")}
                          >
                            {feature.icon}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate font-bold text-slate-900">
                              {feature.title}
                            </div>

                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                              {feature.description}
                            </p>
                          </div>
                        </div>

                        <span
                          className={[
                            "ml-3 shrink-0 text-slate-400 transition",
                            isActive ? "rotate-180 text-blue-600" : "",
                          ].join(" ")}
                        >
                          ▼
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active learning feature */}
                {activeLearningFeature && (
                  <div className="border-t border-slate-200 bg-white p-3 sm:p-5">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
                        <div className="text-sm font-bold text-slate-900">
                          {activeLearningFeature === "review" &&
                            "🔄 Smart Review"}
                          {activeLearningFeature === "recommendation" &&
                            "🎯 Learning Recommendation"}
                          {activeLearningFeature === "study-plan" &&
                            "🗓️ Personal Study Plan"}
                          {activeLearningFeature === "study-mode" &&
                            "📚 Study Mode"}
                          {activeLearningFeature === "quiz" &&
                            "🧠 Practice Quiz"}
                          {activeLearningFeature === "voice" &&
                            "🎙️ Voice Tutor"}
                          {activeLearningFeature === "homework" &&
                            "📝 Homework Helper"}
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveLearningFeature(null)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-slate-900"
                        >
                          Close
                        </button>
                      </div>

                      <div className="p-3 sm:p-5">
                        {activeLearningFeature === "review" && <SmartReview />}
                        {activeLearningFeature === "recommendation" && (
                          <LearningRecommendation />
                        )}
                        {activeLearningFeature === "study-plan" && (
                          <StudyPlan />
                        )}
                        {activeLearningFeature === "study-mode" && (
                          <StudyMode />
                        )}
                        {activeLearningFeature === "quiz" && <QuizCard />}
                        {activeLearningFeature === "voice" && <VoiceTutor />}
                        {activeLearningFeature === "homework" && (
                          <HomeworkHelper />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {!activeLearningFeature && (
                  <div className="border-t border-slate-100 bg-white px-4 py-5 text-center sm:px-6">
                    <p className="text-sm font-medium text-slate-600">
                      ✨ Pick a learning tool to get started
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      You can open one tool at a time to keep your learning
                      space simple.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Chat input */}
          <div className="z-20 shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4">
            <div className="w-full">
              <ChatInput
                question={question}
                loading={loading}
                onQuestionChange={setQuestion}
                onSubmit={handleSubmit}
              />

              <p className="mt-2 text-center text-[11px] text-slate-400">
                Ask EduMate anything you're learning about.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
