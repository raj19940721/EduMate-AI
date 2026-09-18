"use client";

import { useRef, useState } from "react";
import { GoogleGenAI, Modality } from "@google/genai";

type VoiceStatus = "idle" | "connecting" | "listening" | "speaking" | "error";

type ConversationMessage = {
  role: "student" | "edumate";
  text: string;
};

type HomeworkUploadQuestion = {
  id: number;
  question: string;
};

export default function VoiceTutor() {
  const [status, setStatus] = useState<VoiceStatus>("idle");

  const [error, setError] = useState("");

  // --------------------------------------------------
  // Live transcripts
  // --------------------------------------------------

  const [studentTranscript, setStudentTranscript] = useState("");

  const [eduMateTranscript, setEduMateTranscript] = useState("");

  // --------------------------------------------------
  // Conversation history
  // --------------------------------------------------

  const [conversation, setConversation] = useState<ConversationMessage[]>([]);

  // --------------------------------------------------
  // Microphone mute
  // --------------------------------------------------

  const [isMuted, setIsMuted] = useState(false);

  const isMutedRef = useRef(false);

  // --------------------------------------------------
  // Reconnect state
  // --------------------------------------------------

  const [canReconnect, setCanReconnect] = useState(false);

  const isConnectingRef = useRef(false);

  // --------------------------------------------------
  // Current transcript refs
  // --------------------------------------------------

  const currentStudentTranscriptRef = useRef("");

  const currentEduMateTranscriptRef = useRef("");

  // --------------------------------------------------
  // Student transcript completion handling
  // --------------------------------------------------

  const studentTurnCompleteRef = useRef(false);

  const studentTurnProcessTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  // --------------------------------------------------
  // Gemini / Audio refs
  // --------------------------------------------------

  const sessionRef = useRef<any>(null);

  const streamRef = useRef<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);

  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const silentGainRef = useRef<GainNode | null>(null);

  const audioQueueRef = useRef<AudioBuffer[]>([]);

  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const isPlayingRef = useRef(false);

  // --------------------------------------------------
  // RAG / Learning Memory state for the current turn
  // --------------------------------------------------

  const pendingContextRef = useRef(false);

  const waitingForGroundedResponseRef = useRef(false);

  const groundedResponseRequestedRef = useRef(false);

  const groundedResponseReceivedRef = useRef(false);

  const pendingAudioQueueRef = useRef<AudioBuffer[]>([]);

  const pendingEduMateTranscriptRef = useRef("");

  // --------------------------------------------------
  // Voice Quiz state
  // --------------------------------------------------

  type VoiceQuiz = {
    topic: string;
    question: string;
    correctAnswer: string;
    difficulty?: "easy" | "medium" | "hard";
    accuracy?: number;
    masteryLevel?: string;
    questionsAsked?: number;
  };

  const activeQuizRef = useRef<VoiceQuiz | null>(null);

  const quizBusyRef = useRef(false);

  // --------------------------------------------------
  // Voice Homework state
  // --------------------------------------------------

  const homeworkModeRef = useRef(false);
  const homeworkBusyRef = useRef(false);

  // --------------------------------------------------
  // Convert Base64 → Uint8Array
  // --------------------------------------------------

  function base64ToUint8Array(base64: string) {
    const binaryString = atob(base64);

    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes;
  }

  // --------------------------------------------------
  // Convert Gemini PCM audio → AudioBuffer
  //
  // Gemini audio = 24kHz, mono, 16-bit PCM
  // --------------------------------------------------

  function pcmToAudioBuffer(audioContext: AudioContext, base64Data: string) {
    const bytes = base64ToUint8Array(base64Data);

    const int16 = new Int16Array(
      bytes.buffer,
      bytes.byteOffset,
      Math.floor(bytes.byteLength / 2),
    );

    const audioBuffer = audioContext.createBuffer(1, int16.length, 24000);

    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < int16.length; i++) {
      channelData[i] = int16[i] / 32768;
    }

    return audioBuffer;
  }

  // --------------------------------------------------
  // Play Gemini audio
  // --------------------------------------------------

  function playNextAudio() {
    if (isPlayingRef.current) {
      return;
    }

    const audioContext = audioContextRef.current;

    if (!audioContext) {
      return;
    }

    const nextBuffer = audioQueueRef.current.shift();

    if (!nextBuffer) {
      setStatus("listening");
      return;
    }

    isPlayingRef.current = true;

    setStatus("speaking");

    const source = audioContext.createBufferSource();

    source.buffer = nextBuffer;

    source.connect(audioContext.destination);

    currentAudioSourceRef.current = source;

    source.onended = () => {
      currentAudioSourceRef.current = null;

      isPlayingRef.current = false;

      playNextAudio();
    };

    source.start();
  }

  // --------------------------------------------------
  // Fetch RAG + Learning Memory context
  // --------------------------------------------------

  async function fetchVoiceContext(question: string) {
    const cleanedQuestion = question.trim();

    if (!cleanedQuestion) {
      return null;
    }

    console.log("🧠 Fetching Voice Tutor context:", cleanedQuestion);

    const response = await fetch("/api/voice/context", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: cleanedQuestion,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to retrieve learning context.");
    }

    console.log("🧠 Voice Tutor context retrieved:", {
      usedKnowledge: data.rag?.usedKnowledge,
      highRelevanceCount: data.rag?.highRelevanceCount,
      topSimilarity: data.rag?.topSimilarity,
      learningMemoryCount: data.learningMemory?.count,
    });

    return data;
  }

  function buildGroundedVoiceInstruction(question: string, contextData: any) {
    return `
Use the following private educational context to answer the student's question.

IMPORTANT:
- Answer the student's question directly.
- Use the retrieved educational knowledge when relevant.
- Use the student's learning memory when relevant to personalize the explanation.
- Keep the answer appropriate for the student's grade.
- Do not mention RAG, memory, databases, APIs, embeddings, or internal context.
- Do not say that you were given context.
- Do not repeat the context word-for-word unless that is the clearest explanation.
- Speak naturally as EduMate Voice Tutor.

Student Question:
${question}

Student Profile:
${JSON.stringify(contextData.student ?? {}, null, 2)}

Retrieved Educational Knowledge and Learning Memory:
${contextData.context || "No additional educational context was found."}

Now answer the student's question using this context.
`.trim();
  }

  // --------------------------------------------------
  // Stop currently playing / queued audio
  // --------------------------------------------------

  function stopAudioPlayback() {
    audioQueueRef.current = [];

    try {
      currentAudioSourceRef.current?.stop();
    } catch {
      // Audio may already have stopped.
    }

    currentAudioSourceRef.current = null;

    isPlayingRef.current = false;
  }

  // --------------------------------------------------
  // Convert Float32 microphone audio → Base64 PCM
  // --------------------------------------------------

  function float32ToBase64PCM(inputData: Float32Array) {
    const pcmData = new Int16Array(inputData.length);

    for (let i = 0; i < inputData.length; i++) {
      const sample = Math.max(-1, Math.min(1, inputData[i]));

      pcmData[i] = sample < 0 ? sample * 32768 : sample * 32767;
    }

    const bytes = new Uint8Array(pcmData.buffer);

    let binary = "";

    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));

      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  }

  // --------------------------------------------------
  // Add completed conversation turn
  // --------------------------------------------------

  function addConversationMessage(role: "student" | "edumate", text: string) {
    const cleanedText = text.trim();

    if (!cleanedText) {
      return;
    }

    setConversation((previous) => {
      const last = previous[previous.length - 1];

      // If same speaker is already the last message,
      // update it.
      if (last && last.role === role) {
        return [
          ...previous.slice(0, -1),
          {
            role,
            text: cleanedText,
          },
        ];
      }

      return [
        ...previous,
        {
          role,
          text: cleanedText,
        },
      ];
    });
  }

  // --------------------------------------------------
  // Finalize current transcript turn
  // --------------------------------------------------

  function finalizeStudentTranscript() {
    const text = currentStudentTranscriptRef.current.trim();

    if (text) {
      addConversationMessage("student", text);
    }

    currentStudentTranscriptRef.current = "";

    setStudentTranscript("");
  }

  function finalizeEduMateTranscript() {
    const text = currentEduMateTranscriptRef.current.trim();

    if (text) {
      addConversationMessage("edumate", text);
    }

    currentEduMateTranscriptRef.current = "";

    setEduMateTranscript("");
  }

  // --------------------------------------------------
  // Toggle microphone mute
  // --------------------------------------------------

  function toggleMute() {
    const stream = streamRef.current;

    if (!stream) {
      return;
    }

    const newMutedState = !isMuted;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !newMutedState;
    });

    isMutedRef.current = newMutedState;

    setIsMuted(newMutedState);

    console.log(
      newMutedState ? "🔇 Microphone muted" : "🎤 Microphone unmuted",
    );
  }

  // --------------------------------------------------
  // Quiz helpers
  // --------------------------------------------------

  // --------------------------------------------------
  // Quiz helpers
  // --------------------------------------------------

  function isQuizStartRequest(question: string) {
    return /\b(quiz me|start a quiz|give me a quiz|test me|start quiz)\b/i.test(
      question,
    );
  }

  function extractQuizTopic(question: string) {
    const match = question.match(/\b(?:on|about|for)\s+(.+?)(?:[?.!]|$)/i);

    return match?.[1]?.trim() || "";
  }

  // --------------------------------------------------
  // Homework helpers
  // --------------------------------------------------

  function isHomeworkRequest(question: string) {
    return /\b(homework|home work|assignment|worksheet|schoolwork)\b/i.test(
      question,
    );
  }

  // --------------------------------------------------
  // Voice Homework
  // --------------------------------------------------

  async function solveVoiceHomework(question: string) {
    const cleanedQuestion = question.trim();

    if (!cleanedQuestion) {
      throw new Error("Please provide a homework question.");
    }

    console.log("📚 Processing voice homework question:", cleanedQuestion);

    // Get the current student profile so the homework API
    // can use the correct grade and subject.
    const studentResponse = await fetch("/api/student");

    if (!studentResponse.ok) {
      throw new Error("Failed to load student profile.");
    }

    const studentData = await studentResponse.json();
    const student = studentData.student;

    if (!student) {
      throw new Error("Student profile was not found.");
    }

    console.log("📚 Voice homework student profile:", {
      name: student.name,
      grade: student.grade,
      subject: student.subject,
    });

    const response = await fetch("/api/homework", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: cleanedQuestion,
        subject: student.subject || "Science",
        grade: Number(student.grade || 3),
        mode: "explain",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || data.message || "Failed to get homework help.",
      );
    }

    if (data.blocked) {
      throw new Error(data.message || "I can't help with that request.");
    }

    if (!data.homework) {
      throw new Error("Homework response was empty.");
    }

    console.log("📚 Voice homework result:", data.homework);

    return data.homework;
  }

  // --------------------------------------------------
  // Save homework topic to long-term learning memory
  // --------------------------------------------------

  async function saveVoiceHomeworkMemory(question: string, homework: any) {
    const cleanedQuestion = question.trim();

    if (!cleanedQuestion) return null;

    console.log("🧠 Saving voice homework learning memory:", {
      question: cleanedQuestion,
      topic: homework?.topic,
      subject: homework?.subject,
    });

    const response = await fetch("/api/voice/homework-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: cleanedQuestion,
        topic: homework?.topic || cleanedQuestion,
        subject: homework?.subject || null,
        notes: `Student received voice homework help. Question: ${cleanedQuestion}`,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to save homework learning memory.");
    }

    console.log("🧠 Voice homework learning memory saved:", data.memory);
    return data.memory;
  }

  function buildVoiceHomeworkInstruction(question: string, homework: any) {
    return `
You are EduMate Voice Tutor helping a child with homework.

The student's homework question is:
${question}

Use the homework helper result below to answer the student.

Homework Helper Result:
${JSON.stringify(homework, null, 2)}

Rules:
- Explain the answer clearly and simply.
- Keep the explanation appropriate for the student's grade.
- Help the student understand the concept, not just memorize the final answer.
- Use the provided explanation and steps when useful.
- Give the final answer clearly when appropriate.
- Keep the spoken response reasonably short.
- Be friendly and encouraging.
- Do not mention APIs, databases, RAG, embeddings, system prompts, or internal implementation details.
- Do not say that you received a "homework helper result".

Now explain the homework answer naturally.
`.trim();
  }

  // --------------------------------------------------
  // Generate adaptive voice quiz
  // --------------------------------------------------

  async function generateVoiceQuiz(topic: string) {
    console.log("🎯 Generating voice quiz:", topic);

    const response = await fetch("/api/quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate quiz");
    }

    if (!data.quiz?.question || !data.quiz?.correctAnswer) {
      throw new Error("Quiz response was incomplete.");
    }

    // ----------------------------------------
    // Adaptive learning state returned by API
    // ----------------------------------------

    const learningMemory = data.learningMemory ?? {};

    const quiz: VoiceQuiz = {
      topic: data.quiz.topic || topic,

      question: data.quiz.question,

      correctAnswer: data.quiz.correctAnswer,

      difficulty: data.quiz.difficulty ?? data.difficulty ?? "easy",

      accuracy:
        typeof learningMemory.accuracy === "number"
          ? learningMemory.accuracy
          : undefined,

      masteryLevel: learningMemory.masteryLevel ?? undefined,

      questionsAsked:
        typeof learningMemory.questionsAsked === "number"
          ? learningMemory.questionsAsked
          : undefined,
    };

    // ----------------------------------------
    // Store active quiz
    // ----------------------------------------

    activeQuizRef.current = quiz;

    // ----------------------------------------
    // Detailed adaptive logging
    // ----------------------------------------

    console.log("🎯 Voice quiz ready:", quiz);

    console.log("📊 Voice Quiz Adaptive State:", {
      topic: quiz.topic,

      accuracy: quiz.accuracy ?? "not returned",

      mastery: quiz.masteryLevel ?? "not returned",

      questionsAsked: quiz.questionsAsked ?? "not returned",

      difficulty: quiz.difficulty ?? "not returned",
    });

    return quiz;
  }

  // --------------------------------------------------
  // Submit voice quiz answer
  // --------------------------------------------------

  async function submitVoiceQuizAnswer(studentAnswer: string) {
    const quiz = activeQuizRef.current;

    if (!quiz || !studentAnswer.trim()) {
      return null;
    }

    console.log("📝 Submitting voice quiz answer:", {
      topic: quiz.topic,
      question: quiz.question,
      studentAnswer: studentAnswer.trim(),
      currentDifficulty: quiz.difficulty,
      currentAccuracy: quiz.accuracy,
      currentMastery: quiz.masteryLevel,
    });

    const response = await fetch("/api/quiz/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: quiz.topic,
        question: quiz.question,
        studentAnswer: studentAnswer.trim(),
        correctAnswer: quiz.correctAnswer,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to submit quiz answer");
    }

    // --------------------------------------------------
    // Read updated performance
    // --------------------------------------------------

    const evaluation =
      data.result?.evaluation ??
      (data.result?.isCorrect ? "correct" : "incorrect");

    const updatedAccuracy =
      data.performance?.accuracy ?? data.accuracy ?? data.memory?.accuracy;

    const updatedMastery =
      data.performance?.masteryLevel ??
      data.performance?.mastery_level ??
      data.memory?.mastery_level;

    console.log("📊 Voice Quiz Performance:", {
      evaluation,
      previousAccuracy: quiz.accuracy ?? "not returned",
      updatedAccuracy: updatedAccuracy ?? "not returned",
      updatedMastery: updatedMastery ?? "not returned",
    });

    console.log("🎯 Adaptive Quiz Answer Result:", data);

    return data;
  }

  // --------------------------------------------------
  // Build first quiz instruction
  // --------------------------------------------------

  function buildVoiceQuizInstruction(request: string, quiz: VoiceQuiz) {
    return `
You are EduMate Voice Tutor. The student asked to start a quiz.

Introduce the quiz warmly and ask ONLY the quiz question below.
Do not reveal the correct answer.
Keep it short and age-appropriate.

Student request:
${request}

Quiz topic:
${quiz.topic}

Quiz difficulty:
${quiz.difficulty || "adaptive"}

Quiz question:
${quiz.question}

Wait for the student's answer.
`.trim();
  }

  // --------------------------------------------------
  // Build quiz result + next question instruction
  // --------------------------------------------------

  function buildVoiceQuizResultInstruction(
    studentAnswer: string,
    result: any,
    nextQuiz: VoiceQuiz,
  ) {
    const evaluation =
      result?.result?.evaluation ??
      (result?.result?.isCorrect ? "correct" : "incorrect");

    const feedback =
      typeof result?.result?.feedback === "string"
        ? result.result.feedback.trim()
        : "";

    const correctAnswer =
      result?.result?.correctAnswer ||
      result?.result?.expectedAnswer ||
      nextQuiz.correctAnswer ||
      "the correct answer";

    let resultInstruction = "";

    if (evaluation === "correct") {
      resultInstruction = `
The student's answer is correct.
Praise the student briefly and naturally.
${feedback ? `You may use this feedback: ${feedback}` : ""}
`.trim();
    } else if (evaluation === "partially_correct") {
      resultInstruction = `
The student's answer is partially correct.
Acknowledge what the student understood.
Briefly explain what is missing or needs correction.
Do not shame the student.
${feedback ? `Use this evaluator feedback when helpful: ${feedback}` : ""}
`.trim();
    } else {
      resultInstruction = `
The student's answer is incorrect.
Gently explain that it is not correct and give the correct answer.
Keep the correction brief and educational.
${feedback ? `Use this evaluator feedback when helpful: ${feedback}` : ""}
Correct answer: ${correctAnswer}
`.trim();
    }

    return `
You are EduMate Voice Tutor continuing a quiz.

${resultInstruction}

Then ask ONLY the next quiz question below.
Do not reveal the next question's answer.
Do not add another question.
Keep the response short, warm, encouraging, and age-appropriate.

Student answer:
${studentAnswer}

Next topic:
${nextQuiz.topic}

Next difficulty:
${nextQuiz.difficulty || "adaptive"}

Next question:
${nextQuiz.question}
`.trim();
  }

  // --------------------------------------------------
  // Process student turn after final transcription
  //
  // Gemini Live can report turnComplete before the
  // final input transcription text has arrived.
  // We therefore wait briefly and reset the timer
  // whenever more transcript text arrives.
  // --------------------------------------------------

  function scheduleStudentTurnProcessing() {
    if (studentTurnProcessTimerRef.current) {
      clearTimeout(studentTurnProcessTimerRef.current);
    }

    studentTurnProcessTimerRef.current = setTimeout(() => {
      if (!studentTurnCompleteRef.current) {
        return;
      }

      studentTurnCompleteRef.current = false;

      const question = currentStudentTranscriptRef.current.trim();

      if (!question) {
        console.log("⚠️ Student turn completed but transcript is empty.");

        return;
      }

      if (
        waitingForGroundedResponseRef.current ||
        groundedResponseReceivedRef.current ||
        pendingContextRef.current
      ) {
        return;
      }

      pendingContextRef.current = true;

      waitingForGroundedResponseRef.current = true;

      pendingAudioQueueRef.current = [];

      audioQueueRef.current = [];

      pendingEduMateTranscriptRef.current = "";

      console.log("✅ Final student transcript captured:", question);

      void (async () => {
        try {
          let instruction = "";

          // --------------------------------------
          // Start quiz
          // --------------------------------------

          // --------------------------------------
          // Start quiz
          // --------------------------------------

          if (isQuizStartRequest(question)) {
            console.log("🎯 Quiz start request detected:", question);

            let topic = extractQuizTopic(question);

            // --------------------------------------
            // If the student did not specify a topic,
            // use an existing learning-memory topic.
            // --------------------------------------
            if (!topic) {
              console.log(
                "🧠 No quiz topic specified. Loading learning memory...",
              );

              const memoryResponse = await fetch("/api/learning-memory");

              if (!memoryResponse.ok) {
                throw new Error("Failed to load learning memory for the quiz.");
              }

              const memoryData = await memoryResponse.json();

              const memories = Array.isArray(memoryData?.memories)
                ? memoryData.memories
                : Array.isArray(memoryData?.data)
                  ? memoryData.data
                  : [];

              if (memories.length === 0) {
                throw new Error(
                  "I don't have a learning topic yet. Please say a topic, for example: quiz me on photosynthesis.",
                );
              }

              // Prefer a topic that is still being learned/practiced.
              const preferredMemory =
                memories.find(
                  (memory: any) =>
                    memory.mastery_level === "learning" ||
                    memory.mastery_level === "practicing",
                ) || memories[0];

              topic = preferredMemory.topic?.trim() || "";

              if (!topic) {
                throw new Error(
                  "I couldn't find a learning topic for the quiz. Please say a topic, for example: quiz me on photosynthesis.",
                );
              }

              console.log(
                "🧠 Quiz topic selected from learning memory:",
                topic,
              );
            }

            console.log("🎯 Starting voice quiz with topic:", topic);

            const quiz = await generateVoiceQuiz(topic);

            instruction = buildVoiceQuizInstruction(question, quiz);
          }

          // --------------------------------------
          // Answer active quiz
          // --------------------------------------
          else if (activeQuizRef.current) {
            if (quizBusyRef.current) {
              console.log("🎯 Quiz answer is already being processed.");
              return;
            }

            quizBusyRef.current = true;

            const currentQuiz = activeQuizRef.current;

            if (!currentQuiz) {
              throw new Error(
                "Active quiz was lost. Please start the quiz again.",
              );
            }

            console.log("📝 Submitting FINAL voice quiz answer:", {
              topic: currentQuiz.topic,
              question: currentQuiz.question,
              studentAnswer: question,
            });

            const result = await submitVoiceQuizAnswer(question);

            const nextQuiz = await generateVoiceQuiz(currentQuiz.topic);

            instruction = buildVoiceQuizResultInstruction(
              question,
              result,
              nextQuiz,
            );
          }

          // --------------------------------------
          // Homework request
          // --------------------------------------
          else if (isHomeworkRequest(question)) {
            console.log("📚 Homework request detected:", question);

            homeworkModeRef.current = true;

            console.log("📚 Homework mode enabled");

            instruction = `
You are EduMate Voice Tutor.

The student wants help with homework.

Do NOT solve anything yet because the student has not provided the homework question.

Ask the student:
"Sure! Please tell me the homework question, and I'll help you with it."

Keep the response short, friendly, and age-appropriate.
`.trim();
          }

          // --------------------------------------
          // Homework question
          // --------------------------------------
          else if (homeworkModeRef.current) {
            if (homeworkBusyRef.current) {
              console.log("📚 Homework request is already being processed.");
              return;
            }

            homeworkBusyRef.current = true;

            try {
              const homework = await solveVoiceHomework(question);

              await saveVoiceHomeworkMemory(question, homework);

              instruction = buildVoiceHomeworkInstruction(question, homework);

              // The current homework question has been handled.
              homeworkModeRef.current = false;
            } finally {
              homeworkBusyRef.current = false;
            }
          }

          // --------------------------------------
          // Normal grounded question
          // --------------------------------------
          else {
            const contextData = await fetchVoiceContext(question);

            instruction = buildGroundedVoiceInstruction(question, contextData);
          }

          groundedResponseRequestedRef.current = true;

          pendingContextRef.current = false;

          quizBusyRef.current = false;

          console.log("🧠 Sending grounded Voice Tutor instruction.");

          sessionRef.current?.sendRealtimeInput({
            text: instruction,
          });
        } catch (contextError) {
          console.error("Voice Tutor context/quiz error:", contextError);

          pendingContextRef.current = false;

          waitingForGroundedResponseRef.current = false;

          groundedResponseRequestedRef.current = false;

          groundedResponseReceivedRef.current = true;

          quizBusyRef.current = false;

          currentEduMateTranscriptRef.current =
            "Sorry, I couldn't complete that request. Please try again.";

          setEduMateTranscript(currentEduMateTranscriptRef.current);

          finalizeStudentTranscript();

          finalizeEduMateTranscript();
        }
      })();
    }, 700);
  }

  // --------------------------------------------------
  // Clear grounded turn state
  // --------------------------------------------------

  function clearGroundedTurnState() {
    pendingContextRef.current = false;

    waitingForGroundedResponseRef.current = false;

    groundedResponseRequestedRef.current = false;

    groundedResponseReceivedRef.current = false;

    studentTurnCompleteRef.current = false;

    if (studentTurnProcessTimerRef.current) {
      clearTimeout(studentTurnProcessTimerRef.current);

      studentTurnProcessTimerRef.current = null;
    }

    pendingAudioQueueRef.current = [];

    pendingEduMateTranscriptRef.current = "";
  }

  // --------------------------------------------------
  // Clean up voice resources
  // --------------------------------------------------

  function cleanupVoiceResources() {
    try {
      processorRef.current?.disconnect();

      sourceRef.current?.disconnect();

      silentGainRef.current?.disconnect();

      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      sessionRef.current?.close();

      audioContextRef.current?.close();
    } catch (error) {
      console.error("Voice cleanup error:", error);
    }

    processorRef.current = null;

    sourceRef.current = null;

    silentGainRef.current = null;

    streamRef.current = null;

    sessionRef.current = null;

    audioContextRef.current = null;

    stopAudioPlayback();

    isMutedRef.current = false;

    setIsMuted(false);
  }

  // --------------------------------------------------
  // Start Voice Tutor
  // --------------------------------------------------

  async function startVoice() {
    // Prevent duplicate sessions
    if (isConnectingRef.current) {
      return;
    }

    if (sessionRef.current || streamRef.current) {
      console.log("Voice session already active.");

      return;
    }

    try {
      isConnectingRef.current = true;

      setError("");

      setCanReconnect(false);

      // Start a fresh live transcript
      currentStudentTranscriptRef.current = "";

      currentEduMateTranscriptRef.current = "";

      setStudentTranscript("");

      setEduMateTranscript("");

      clearGroundedTurnState();

      // Start a fresh homework mode for a new voice session.
      homeworkModeRef.current = false;
      homeworkBusyRef.current = false;

      isMutedRef.current = false;

      setIsMuted(false);

      setStatus("connecting");

      // ----------------------------------------------
      // 1. Get secure ephemeral token
      // ----------------------------------------------

      const tokenResponse = await fetch("/api/live/token");

      if (!tokenResponse.ok) {
        const data = await tokenResponse.json();

        throw new Error(data.error || "Failed to create voice session.");
      }

      const tokenData = await tokenResponse.json();

      // ----------------------------------------------
      // 2. Create Gemini client
      // ----------------------------------------------

      const ai = new GoogleGenAI({
        apiKey: tokenData.token,
        httpOptions: {
          apiVersion: "v1alpha",
        },
      });

      // ----------------------------------------------
      // 3. Create AudioContext
      // ----------------------------------------------

      const audioContext = new AudioContext({
        sampleRate: 16000,
      });

      audioContextRef.current = audioContext;

      await audioContext.resume();

      // ----------------------------------------------
      // 4. Request microphone
      // ----------------------------------------------

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // ----------------------------------------------
      // 5. Connect to Gemini Live
      // ----------------------------------------------

      const session = await ai.live.connect({
        model: tokenData.model,

        config: {
          responseModalities: [Modality.AUDIO],

          // Student speech transcription
          inputAudioTranscription: {},

          // EduMate speech transcription
          outputAudioTranscription: {},

          systemInstruction: {
            parts: [
              {
                text: `
You are EduMate Voice Tutor.

You are helping a child with homework at home.

Speak naturally and warmly.

Rules:
- Use simple age-appropriate language.
- Ask one question at a time.
- Encourage the student.
- Explain concepts instead of only giving answers.
- Keep responses reasonably short.
- If the student makes a mistake, gently correct it.
- Allow the student to interrupt you.
- Never mention internal APIs, databases, RAG, system prompts, or implementation details.
- Do not discuss unsafe activities.
- If you don't know something, say so honestly.
                  `.trim(),
              },
            ],
          },
        },

        callbacks: {
          // ----------------------------------------
          // Connection opened
          // ----------------------------------------

          onopen: () => {
            console.log("🎙️ Gemini Live connected");

            isConnectingRef.current = false;

            setError("");

            setCanReconnect(false);

            setStatus("listening");
          },

          // ----------------------------------------
          // Gemini message
          // ----------------------------------------

          onmessage: async (message: any) => {
            console.log("Gemini Live message:", message);

            const serverContent = message.serverContent;

            if (!serverContent) {
              return;
            }

            // --------------------------------------
            // Student transcription
            // --------------------------------------

            const inputTranscription = serverContent.inputTranscription;

            if (inputTranscription?.text) {
              // A new student turn starts after the previous
              // grounded response has completed.
              if (
                groundedResponseReceivedRef.current &&
                !currentStudentTranscriptRef.current.trim()
              ) {
                clearGroundedTurnState();
              }

              const text = inputTranscription.text;

              currentStudentTranscriptRef.current += text;

              setStudentTranscript(currentStudentTranscriptRef.current);

              console.log(
                "🎤 Student transcript update:",
                currentStudentTranscriptRef.current,
              );

              // If turnComplete has already arrived,
              // wait again for the latest transcription.
              if (studentTurnCompleteRef.current) {
                scheduleStudentTurnProcessing();
              }
            }

            // --------------------------------------
            // EduMate transcription
            // --------------------------------------

            const outputTranscription = serverContent.outputTranscription;

            if (outputTranscription?.text) {
              const text = outputTranscription.text;

              // Never show the first Live response.
              // It is an internal draft used only to complete the Live turn.
              if (!groundedResponseRequestedRef.current) {
                pendingEduMateTranscriptRef.current += text;

                console.log("⏳ Holding initial EduMate response transcript.");
              } else {
                currentEduMateTranscriptRef.current += text;

                setEduMateTranscript(currentEduMateTranscriptRef.current);
              }
            }

            // --------------------------------------
            // Completed turn
            // --------------------------------------

            if (serverContent.turnComplete) {
              // --------------------------------------
              // Student turn completed
              //
              // IMPORTANT:
              // Gemini Live may send turnComplete before
              // the final input transcription arrives.
              //
              // Do NOT process the answer immediately.
              // Mark the turn as complete and wait briefly.
              // --------------------------------------

              if (
                !waitingForGroundedResponseRef.current &&
                !groundedResponseReceivedRef.current
              ) {
                studentTurnCompleteRef.current = true;

                console.log(
                  "⏳ Student turnComplete received. Waiting for final transcription...",
                );

                scheduleStudentTurnProcessing();

                return;
              }

              // --------------------------------------
              // Grounded EduMate response completed
              // --------------------------------------

              if (
                waitingForGroundedResponseRef.current &&
                !groundedResponseReceivedRef.current
              ) {
                waitingForGroundedResponseRef.current = false;

                groundedResponseRequestedRef.current = false;

                groundedResponseReceivedRef.current = true;

                pendingContextRef.current = false;

                quizBusyRef.current = false;

                console.log("✅ Grounded Voice Tutor response completed.");

                finalizeStudentTranscript();

                finalizeEduMateTranscript();
              }
            }

            // --------------------------------------
            // Gemini response interrupted
            // --------------------------------------

            if (serverContent.interrupted) {
              console.log("🛑 Gemini response interrupted");

              stopAudioPlayback();

              // Do not finalize incomplete
              // EduMate speech after interruption.
              currentEduMateTranscriptRef.current = "";

              setEduMateTranscript("");

              setStatus("listening");

              // Reset the current grounded-turn state after an interruption.
              clearGroundedTurnState();

              return;
            }

            // --------------------------------------
            // Model audio
            // --------------------------------------

            const modelTurn = serverContent.modelTurn;

            if (!modelTurn?.parts) {
              return;
            }

            const audioContext = audioContextRef.current;

            if (!audioContext) {
              return;
            }

            for (const part of modelTurn.parts) {
              const inlineData = part.inlineData;

              if (!inlineData?.data) {
                continue;
              }

              if (inlineData.mimeType?.startsWith("audio/")) {
                const audioBuffer = pcmToAudioBuffer(
                  audioContext,
                  inlineData.data,
                );

                if (!groundedResponseRequestedRef.current) {
                  // Buffer ALL audio from the initial ungrounded Live response.
                  pendingAudioQueueRef.current.push(audioBuffer);
                } else {
                  // Only grounded response reaches the speaker.
                  audioQueueRef.current.push(audioBuffer);

                  playNextAudio();
                }
              }
            }
          },

          // ----------------------------------------
          // Error
          // ----------------------------------------

          onerror: (event: any) => {
            console.error("Gemini Live error:", event);

            isConnectingRef.current = false;

            setError(
              "Voice connection was interrupted. You can reconnect and continue.",
            );

            cleanupVoiceResources();

            setCanReconnect(true);

            setStatus("error");
          },

          // ----------------------------------------
          // Connection closed
          // ----------------------------------------

          onclose: (event: any) => {
            console.log("Gemini Live closed:", event);

            isConnectingRef.current = false;

            cleanupVoiceResources();

            setCanReconnect(true);

            setStatus("error");

            setError(
              "Voice connection closed. You can reconnect and continue.",
            );
          },
        },
      });

      sessionRef.current = session;

      // ----------------------------------------------
      // 6. Create microphone source
      // ----------------------------------------------

      const source = audioContext.createMediaStreamSource(stream);

      sourceRef.current = source;

      // ----------------------------------------------
      // 7. Create microphone processor
      // ----------------------------------------------

      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processorRef.current = processor;

      // ----------------------------------------------
      // 8. Send microphone audio to Gemini
      // ----------------------------------------------

      processor.onaudioprocess = (event) => {
        if (!sessionRef.current) {
          return;
        }

        // Don't send microphone audio
        // when muted.
        if (isMutedRef.current) {
          return;
        }

        const inputData = event.inputBuffer.getChannelData(0);

        const base64Audio = float32ToBase64PCM(inputData);

        sessionRef.current.sendRealtimeInput({
          audio: {
            data: base64Audio,
            mimeType: "audio/pcm;rate=16000",
          },
        });
      };

      source.connect(processor);

      // ----------------------------------------------
      // Keep processor alive without sending
      // microphone audio to speakers.
      // ----------------------------------------------

      const silentGain = audioContext.createGain();

      silentGain.gain.value = 0;

      silentGainRef.current = silentGain;

      processor.connect(silentGain);

      silentGain.connect(audioContext.destination);

      console.log("🎤 Microphone streaming started");
    } catch (err) {
      console.error("Voice Tutor error:", err);

      isConnectingRef.current = false;

      cleanupVoiceResources();

      setError(
        err instanceof Error ? err.message : "Unable to start voice tutor.",
      );

      setCanReconnect(true);

      setStatus("error");
    }
  }

  // --------------------------------------------------
  // Reconnect
  // --------------------------------------------------

  async function reconnectVoice() {
    console.log("🔄 Reconnecting Voice Tutor...");

    setError("");

    setCanReconnect(false);

    // Clean up anything left from the
    // previous connection.
    cleanupVoiceResources();

    setStatus("connecting");

    await startVoice();
  }

  // --------------------------------------------------
  // Stop Voice Tutor
  // --------------------------------------------------

  function stopVoice() {
    console.log("🛑 Stopping Voice Tutor");

    isConnectingRef.current = false;

    cleanupVoiceResources();

    currentStudentTranscriptRef.current = "";

    currentEduMateTranscriptRef.current = "";

    setStudentTranscript("");

    setEduMateTranscript("");

    clearGroundedTurnState();

    homeworkModeRef.current = false;
    homeworkBusyRef.current = false;

    setCanReconnect(false);

    setError("");

    setStatus("idle");
  }

  // --------------------------------------------------
  // Voice Homework Upload (Image / PDF)
  // --------------------------------------------------

  const homeworkFileInputRef = useRef<HTMLInputElement | null>(null);

  const [homeworkUploadBusy, setHomeworkUploadBusy] = useState(false);
  const [homeworkQuestions, setHomeworkQuestions] = useState<
    HomeworkUploadQuestion[]
  >([]);
  const [selectedHomeworkQuestionId, setSelectedHomeworkQuestionId] = useState<
    number | null
  >(null);
  const [homeworkDetectedSubject, setHomeworkDetectedSubject] = useState("");
  const [homeworkUploadFileName, setHomeworkUploadFileName] = useState("");
  const [homeworkUploadMessage, setHomeworkUploadMessage] = useState("");

  function resetHomeworkUpload() {
    setHomeworkQuestions([]);
    setSelectedHomeworkQuestionId(null);
    setHomeworkDetectedSubject("");
    setHomeworkUploadFileName("");
    setHomeworkUploadMessage("");
  }

  async function handleHomeworkFileUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (status !== "listening" && status !== "speaking") {
      setHomeworkUploadMessage(
        "Start Voice Tutor first, then upload the homework.",
      );
      event.target.value = "";
      return;
    }

    const isImage = file.type.startsWith("image/");

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isImage && !isPdf) {
      setHomeworkUploadMessage("Please upload a homework image or PDF file.");
      event.target.value = "";
      return;
    }

    setHomeworkUploadBusy(true);
    setHomeworkUploadMessage("Reading your homework...");
    setHomeworkQuestions([]);
    setSelectedHomeworkQuestionId(null);
    setHomeworkDetectedSubject("");
    setHomeworkUploadFileName(file.name);

    try {
      const formData = new FormData();

      // IMPORTANT:
      // Image API expects "image"
      // PDF API expects "pdf"
      if (isImage) {
        formData.append("image", file);
      } else {
        formData.append("pdf", file);
      }

      const endpoint = isImage ? "/api/homework/image" : "/api/homework/pdf";

      console.log("📎 Uploading voice homework file:", {
        name: file.name,
        type: file.type,
        endpoint,
      });

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      console.log("📎 Voice homework upload API response:", data);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Failed to read homework file.",
        );
      }

      if (data.blocked) {
        throw new Error(data.message || "I can't help with that request.");
      }

      // --------------------------------------------------
      // IMPORTANT:
      // Existing Homework Helper returns:
      //
      // {
      //   homework: {
      //     questions: [...]
      //     subject: "Science"
      //     imageClear: true
      //   }
      // }
      // --------------------------------------------------

      const homework = data.homework;

      if (!homework) {
        throw new Error("Homework data was not returned by the server.");
      }

      // --------------------------------------------------
      // Check image clarity when available
      // --------------------------------------------------

      if (typeof homework.imageClear === "boolean" && !homework.imageClear) {
        throw new Error(
          homework.message ||
            "The image is unclear. Please upload a clearer image.",
        );
      }

      // --------------------------------------------------
      // Read questions from data.homework.questions
      // --------------------------------------------------

      const rawQuestions = Array.isArray(homework.questions)
        ? homework.questions
        : [];

      console.log("📎 Extracted homework questions:", rawQuestions);

      const questions: HomeworkUploadQuestion[] = rawQuestions
        .map((item: unknown, index: number) => {
          const questionText =
            typeof item === "string"
              ? item
              : typeof item === "object" &&
                  item !== null &&
                  "question" in item &&
                  typeof (
                    item as {
                      question?: unknown;
                    }
                  ).question === "string"
                ? (
                    item as {
                      question: string;
                    }
                  ).question
                : "";

          return {
            id: index + 1,
            question: questionText.trim(),
          };
        })
        .filter((item: { question: string }) => item.question.length > 0);

      if (questions.length === 0) {
        throw new Error(
          "I couldn't find any clear homework questions in that file.",
        );
      }

      // --------------------------------------------------
      // Save questions
      // --------------------------------------------------

      setHomeworkQuestions(questions);

      setSelectedHomeworkQuestionId(questions[0].id);

      // --------------------------------------------------
      // Save detected subject
      // --------------------------------------------------

      const detectedSubject =
        typeof homework.subject === "string" && homework.subject !== "Unknown"
          ? homework.subject
          : "";

      setHomeworkDetectedSubject(detectedSubject);

      // --------------------------------------------------
      // Success message
      // --------------------------------------------------

      setHomeworkUploadMessage(
        questions.length === 1
          ? "Homework question found."
          : `${questions.length} homework questions found. Choose one to solve.`,
      );

      console.log("📎 Voice homework extraction successful:", {
        fileName: file.name,
        questionCount: questions.length,
        detectedSubject,
        questions,
      });
    } catch (uploadError) {
      console.error("📎 Voice homework upload error:", uploadError);

      setHomeworkUploadMessage(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to read the homework file.",
      );
    } finally {
      setHomeworkUploadBusy(false);

      // Allow the same file to be selected again
      event.target.value = "";
    }
  }

  async function solveUploadedHomework() {
    const selectedQuestion = homeworkQuestions.find(
      (item) => item.id === selectedHomeworkQuestionId,
    );

    if (!selectedQuestion) {
      setHomeworkUploadMessage("Please select a homework question first.");
      return;
    }

    if (!sessionRef.current) {
      setHomeworkUploadMessage(
        "Please connect Voice Tutor before solving the homework.",
      );
      return;
    }

    if (homeworkBusyRef.current) {
      setHomeworkUploadMessage(
        "This homework question is already being processed.",
      );
      return;
    }

    homeworkBusyRef.current = true;
    homeworkModeRef.current = true;
    setHomeworkUploadMessage("EduMate is solving the selected question...");
    setError("");

    try {
      const studentResponse = await fetch("/api/student");

      if (!studentResponse.ok) {
        throw new Error("Failed to load student profile.");
      }

      const studentData = await studentResponse.json();
      const student = studentData.student;

      if (!student) {
        throw new Error("Student profile was not found.");
      }

      const response = await fetch("/api/homework", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: selectedQuestion.question,
          subject: homeworkDetectedSubject || student.subject || "Science",
          grade: Number(student.grade || 3),
          mode: "explain",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Failed to get homework help.",
        );
      }

      if (data.blocked) {
        throw new Error(data.message || "I can't help with that request.");
      }

      if (!data.homework) {
        throw new Error("Homework response was empty.");
      }

      console.log("📚 Uploaded voice homework result:", data.homework);

      await saveVoiceHomeworkMemory(selectedQuestion.question, data.homework);

      const instruction = buildVoiceHomeworkInstruction(
        selectedQuestion.question,
        data.homework,
      );

      pendingContextRef.current = false;
      waitingForGroundedResponseRef.current = false;
      groundedResponseRequestedRef.current = true;
      groundedResponseReceivedRef.current = false;
      pendingEduMateTranscriptRef.current = "";
      currentEduMateTranscriptRef.current = "";
      setEduMateTranscript("");

      sessionRef.current?.sendRealtimeInput({
        text: instruction,
      });

      homeworkModeRef.current = false;
      setHomeworkUploadMessage("Done! EduMate is explaining the answer.");
    } catch (solveError) {
      console.error("📚 Uploaded voice homework solve error:", solveError);
      setHomeworkUploadMessage(
        solveError instanceof Error
          ? solveError.message
          : "Failed to solve the homework question.",
      );
      homeworkModeRef.current = false;
    } finally {
      homeworkBusyRef.current = false;
    }
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="voice-tutor">
      <div className="voice-tutor__header">
        <div>
          <span className="voice-tutor__eyebrow">Voice Learning</span>
          <h2>🎙️ EduMate Voice Tutor</h2>
          <p>Talk to EduMate using your voice.</p>
        </div>

        <div
          className={`voice-tutor__indicator voice-tutor__indicator--${status}`}
        >
          <span className="voice-tutor__pulse" aria-hidden="true" />
          <span className="voice-tutor__indicator-bubble">
            {status === "listening" && "🎤"}
            {status === "speaking" && "🔊"}
            {status === "connecting" && "⏳"}
            {status === "error" && "⚠️"}
            {status === "idle" && "💬"}
          </span>
        </div>
      </div>

      <div
        className={`voice-tutor__status ${
          status === "error"
            ? "voice-tutor__status--error"
            : isMuted
              ? "voice-tutor__status--muted"
              : status === "speaking"
                ? "voice-tutor__status--speaking"
                : status === "listening"
                  ? "voice-tutor__status--listening"
                  : ""
        }`}
      >
        <span>
          {status === "idle" && "Ready to talk"}
          {status === "connecting" && "⏳ Connecting to EduMate..."}
          {status === "listening" && !isMuted && "🎤 Listening..."}
          {status === "listening" && isMuted && "🔇 Microphone muted"}
          {status === "speaking" && "🔊 EduMate is speaking..."}
          {status === "error" && "⚠️ Voice connection needs attention"}
        </span>
      </div>

      {error && (
        <div className="voice-tutor__alert voice-tutor__alert--error">
          {error}
        </div>
      )}

      {(studentTranscript ||
        eduMateTranscript ||
        status === "listening" ||
        status === "speaking") && (
        <div className="voice-tutor__transcript-list">
          {studentTranscript && (
            <div className="voice-tutor__bubble voice-tutor__bubble--user">
              <div className="voice-tutor__bubble-head">
                <span>🧑‍🎓</span>
                <span>You</span>
              </div>
              <p>{studentTranscript}</p>
            </div>
          )}

          {eduMateTranscript && (
            <div className="voice-tutor__bubble">
              <div className="voice-tutor__bubble-head">
                <span>🤖</span>
                <span>EduMate</span>
              </div>
              <p>{eduMateTranscript}</p>
            </div>
          )}
        </div>
      )}

      {conversation.length > 0 && (
        <div className="voice-tutor__history">
          <div className="voice-tutor__history-header">
            <h3>📝 Conversation</h3>
            <span>
              {conversation.length}{" "}
              {conversation.length === 1 ? "message" : "messages"}
            </span>
          </div>

          <div className="voice-tutor__history-list">
            {conversation.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`voice-tutor__message ${message.role === "student" ? "voice-tutor__message--user" : ""}`}
              >
                <div className="voice-tutor__message-box">
                  <div className="voice-tutor__message-tag">
                    {message.role === "student" ? "🧑‍🎓 You" : "🤖 EduMate"}
                  </div>
                  <p>{message.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="voice-tutor__upload">
        <div className="voice-tutor__upload-header">
          <div>
            <h3>📎 Homework Image / PDF</h3>
            <p>
              Upload a worksheet or homework photo while Voice Tutor is active.
            </p>
          </div>

          <input
            ref={homeworkFileInputRef}
            type="file"
            accept="image/*,.pdf,application/pdf"
            onChange={handleHomeworkFileUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => homeworkFileInputRef.current?.click()}
            disabled={
              homeworkUploadBusy ||
              status === "idle" ||
              status === "connecting" ||
              status === "error"
            }
            className="voice-tutor__upload-button"
          >
            {homeworkUploadBusy ? "⏳ Reading..." : "📎 Upload Homework"}
          </button>
        </div>

        {homeworkUploadFileName && (
          <p className="voice-tutor__upload-file">
            File: <span>{homeworkUploadFileName}</span>
            {homeworkDetectedSubject && (
              <>
                {" "}
                · Subject: <span>{homeworkDetectedSubject}</span>
              </>
            )}
          </p>
        )}

        {homeworkUploadMessage && (
          <div className="voice-tutor__upload-message">
            {homeworkUploadMessage}
          </div>
        )}

        {homeworkQuestions.length > 0 && (
          <div className="voice-tutor__question-list">
            <p className="voice-tutor__upload-file">Select a question</p>

            {homeworkQuestions.map((item) => (
              <label
                key={item.id}
                className={`voice-tutor__question ${selectedHomeworkQuestionId === item.id ? "voice-tutor__question--active" : ""}`}
              >
                <input
                  type="radio"
                  name="voice-homework-question"
                  checked={selectedHomeworkQuestionId === item.id}
                  onChange={() => setSelectedHomeworkQuestionId(item.id)}
                />
                <span className="voice-tutor__question-text">
                  <strong>Q{item.id}.</strong> {item.question}
                </span>
              </label>
            ))}

            <div className="voice-tutor__question-actions">
              <button
                type="button"
                onClick={solveUploadedHomework}
                disabled={
                  homeworkBusyRef.current ||
                  homeworkUploadBusy ||
                  !selectedHomeworkQuestionId
                }
                className="voice-tutor__action"
              >
                🤖 Solve & Speak
              </button>

              <button
                type="button"
                onClick={resetHomeworkUpload}
                disabled={homeworkUploadBusy}
                className="voice-tutor__action--secondary"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="voice-tutor__controls">
        {status === "idle" && (
          <button onClick={startVoice} className="voice-tutor__action">
            🎤 Start Voice Tutor
          </button>
        )}

        {status === "connecting" && (
          <button disabled className="voice-tutor__action--secondary">
            ⏳ Connecting...
          </button>
        )}

        {(status === "listening" || status === "speaking") && (
          <>
            <button
              onClick={toggleMute}
              className={
                isMuted
                  ? "voice-tutor__action"
                  : "voice-tutor__action--secondary"
              }
            >
              {isMuted ? "🔊 Unmute" : "🔇 Mute"}
            </button>

            <button onClick={stopVoice} className="voice-tutor__action--danger">
              ⏹ Stop Voice Tutor
            </button>
          </>
        )}

        {status === "error" && (
          <>
            {canReconnect && (
              <button onClick={reconnectVoice} className="voice-tutor__action">
                🔄 Reconnect
              </button>
            )}

            <button
              onClick={stopVoice}
              className="voice-tutor__action--secondary"
            >
              ✕ Close
            </button>
          </>
        )}
      </div>

      {status !== "idle" && status !== "error" && (
        <p className="voice-tutor__hint">
          {isMuted
            ? "🔇 Your microphone is muted. EduMate can still speak."
            : "🎤 You can interrupt EduMate or mute your microphone anytime."}
        </p>
      )}
    </div>
  );
}
