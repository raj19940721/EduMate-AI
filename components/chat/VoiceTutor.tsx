"use client";

import { useRef, useState } from "react";
import { GoogleGenAI, Modality } from "@google/genai";

type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "error";

type ConversationMessage = {
  role: "student" | "edumate";
  text: string;
};

export default function VoiceTutor() {
  const [status, setStatus] =
    useState<VoiceStatus>("idle");

  const [error, setError] = useState("");

  // --------------------------------------------------
  // Live transcripts
  // --------------------------------------------------

  const [studentTranscript, setStudentTranscript] =
    useState("");

  const [eduMateTranscript, setEduMateTranscript] =
    useState("");

  // --------------------------------------------------
  // Conversation history
  // --------------------------------------------------

  const [conversation, setConversation] =
    useState<ConversationMessage[]>([]);

  // --------------------------------------------------
  // Microphone mute
  // --------------------------------------------------

  const [isMuted, setIsMuted] =
    useState(false);

  const isMutedRef =
    useRef(false);

  // --------------------------------------------------
  // Reconnect state
  // --------------------------------------------------

  const [canReconnect, setCanReconnect] =
    useState(false);

  const isConnectingRef =
    useRef(false);

  // --------------------------------------------------
  // Current transcript refs
  // --------------------------------------------------

  const currentStudentTranscriptRef =
    useRef("");

  const currentEduMateTranscriptRef =
    useRef("");

  // --------------------------------------------------
  // Gemini / Audio refs
  // --------------------------------------------------

  const sessionRef =
    useRef<any>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const audioContextRef =
    useRef<AudioContext | null>(null);

  const processorRef =
    useRef<ScriptProcessorNode | null>(null);

  const sourceRef =
    useRef<MediaStreamAudioSourceNode | null>(null);

  const silentGainRef =
    useRef<GainNode | null>(null);

  const audioQueueRef =
    useRef<AudioBuffer[]>([]);

  const currentAudioSourceRef =
    useRef<AudioBufferSourceNode | null>(null);

  const isPlayingRef =
    useRef(false);

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
  };

  const activeQuizRef = useRef<VoiceQuiz | null>(null);
  const quizBusyRef = useRef(false);

  // --------------------------------------------------
  // Convert Base64 → Uint8Array
  // --------------------------------------------------

  function base64ToUint8Array(
    base64: string
  ) {
    const binaryString =
      atob(base64);

    const bytes =
      new Uint8Array(
        binaryString.length
      );

    for (
      let i = 0;
      i < binaryString.length;
      i++
    ) {
      bytes[i] =
        binaryString.charCodeAt(i);
    }

    return bytes;
  }

  // --------------------------------------------------
  // Convert Gemini PCM audio → AudioBuffer
  //
  // Gemini audio = 24kHz, mono, 16-bit PCM
  // --------------------------------------------------

  function pcmToAudioBuffer(
    audioContext: AudioContext,
    base64Data: string
  ) {
    const bytes =
      base64ToUint8Array(
        base64Data
      );

    const int16 =
      new Int16Array(
        bytes.buffer,
        bytes.byteOffset,
        Math.floor(
          bytes.byteLength / 2
        )
      );

    const audioBuffer =
      audioContext.createBuffer(
        1,
        int16.length,
        24000
      );

    const channelData =
      audioBuffer.getChannelData(0);

    for (
      let i = 0;
      i < int16.length;
      i++
    ) {
      channelData[i] =
        int16[i] / 32768;
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

    const audioContext =
      audioContextRef.current;

    if (!audioContext) {
      return;
    }

    const nextBuffer =
      audioQueueRef.current.shift();

    if (!nextBuffer) {
      setStatus("listening");
      return;
    }

    isPlayingRef.current = true;

    setStatus("speaking");

    const source =
      audioContext.createBufferSource();

    source.buffer = nextBuffer;

    source.connect(
      audioContext.destination
    );

    currentAudioSourceRef.current =
      source;

    source.onended = () => {
      currentAudioSourceRef.current =
        null;

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
      throw new Error(
        data.error || "Failed to retrieve learning context.",
      );
    }

    console.log("🧠 Voice Tutor context retrieved:", {
      usedKnowledge: data.rag?.usedKnowledge,
      highRelevanceCount: data.rag?.highRelevanceCount,
      topSimilarity: data.rag?.topSimilarity,
      learningMemoryCount: data.learningMemory?.count,
    });

    return data;
  }

  function buildGroundedVoiceInstruction(
    question: string,
    contextData: any,
  ) {
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

    currentAudioSourceRef.current =
      null;

    isPlayingRef.current = false;
  }

  // --------------------------------------------------
  // Convert Float32 microphone audio → Base64 PCM
  // --------------------------------------------------

  function float32ToBase64PCM(
    inputData: Float32Array
  ) {
    const pcmData =
      new Int16Array(
        inputData.length
      );

    for (
      let i = 0;
      i < inputData.length;
      i++
    ) {
      const sample =
        Math.max(
          -1,
          Math.min(
            1,
            inputData[i]
          )
        );

      pcmData[i] =
        sample < 0
          ? sample * 32768
          : sample * 32767;
    }

    const bytes =
      new Uint8Array(
        pcmData.buffer
      );

    let binary = "";

    const chunkSize = 0x8000;

    for (
      let i = 0;
      i < bytes.length;
      i += chunkSize
    ) {
      const chunk =
        bytes.subarray(
          i,
          Math.min(
            i + chunkSize,
            bytes.length
          )
        );

      binary +=
        String.fromCharCode(
          ...chunk
        );
    }

    return btoa(binary);
  }

  // --------------------------------------------------
  // Add completed conversation turn
  // --------------------------------------------------

  function addConversationMessage(
    role: "student" | "edumate",
    text: string
  ) {
    const cleanedText =
      text.trim();

    if (!cleanedText) {
      return;
    }

    setConversation(
      (previous) => {
        const last =
          previous[previous.length - 1];

        // If same speaker is already the
        // last message, update it.
        if (
          last &&
          last.role === role
        ) {
          return [
            ...previous.slice(
              0,
              -1
            ),
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
      }
    );
  }

  // --------------------------------------------------
  // Finalize current transcript turn
  // --------------------------------------------------

  function finalizeStudentTranscript() {
    const text =
      currentStudentTranscriptRef.current.trim();

    if (text) {
      addConversationMessage(
        "student",
        text
      );
    }

    currentStudentTranscriptRef.current =
      "";

    setStudentTranscript("");
  }

  function finalizeEduMateTranscript() {
    const text =
      currentEduMateTranscriptRef.current.trim();

    if (text) {
      addConversationMessage(
        "edumate",
        text
      );
    }

    currentEduMateTranscriptRef.current =
      "";

    setEduMateTranscript("");
  }

  // --------------------------------------------------
  // Toggle microphone mute
  // --------------------------------------------------

  function toggleMute() {
    const stream =
      streamRef.current;

    if (!stream) {
      return;
    }

    const newMutedState =
      !isMuted;

    stream
      .getAudioTracks()
      .forEach((track) => {
        track.enabled =
          !newMutedState;
      });

    isMutedRef.current =
      newMutedState;

    setIsMuted(
      newMutedState
    );

    console.log(
      newMutedState
        ? "🔇 Microphone muted"
        : "🎤 Microphone unmuted"
    );
  }

  function isQuizStartRequest(question: string) {
    return /\b(quiz me|start a quiz|give me a quiz|test me)\b/i.test(question)
      && /\b(on|about|for)\b/i.test(question);
  }

  function extractQuizTopic(question: string) {
    const match = question.match(/\b(?:on|about|for)\s+(.+?)(?:[?.!]|$)/i);
    return match?.[1]?.trim() || "";
  }

  async function generateVoiceQuiz(topic: string) {
    console.log("🎯 Generating voice quiz:", topic);
    const response = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to generate quiz");
    if (!data.quiz?.question || !data.quiz?.correctAnswer) {
      throw new Error("Quiz response was incomplete.");
    }
    const quiz: VoiceQuiz = {
      topic: data.quiz.topic || topic,
      question: data.quiz.question,
      correctAnswer: data.quiz.correctAnswer,
    };
    activeQuizRef.current = quiz;
    console.log("🎯 Voice quiz ready:", quiz);
    return quiz;
  }

  async function submitVoiceQuizAnswer(studentAnswer: string) {
    const quiz = activeQuizRef.current;
    if (!quiz || !studentAnswer.trim()) return null;
    const response = await fetch("/api/quiz/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: quiz.topic,
        question: quiz.question,
        studentAnswer: studentAnswer.trim(),
        correctAnswer: quiz.correctAnswer,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to submit quiz answer");
    return data;
  }

  function buildVoiceQuizInstruction(request: string, quiz: VoiceQuiz) {
    return `
You are EduMate Voice Tutor. The student asked to start a quiz.
Introduce the quiz warmly and ask ONLY the quiz question below.
Do not reveal the correct answer. Keep it short and age-appropriate.

Student request: ${request}
Quiz topic: ${quiz.topic}
Quiz question: ${quiz.question}

Wait for the student's answer.
`.trim();
  }

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

Next question:
${nextQuiz.question}
`.trim();
  }

  function clearGroundedTurnState() {
    pendingContextRef.current = false;
    waitingForGroundedResponseRef.current = false;
    groundedResponseRequestedRef.current = false;
    groundedResponseReceivedRef.current = false;
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

      streamRef.current
        ?.getTracks()
        .forEach((track) => {
          track.stop();
        });

      sessionRef.current?.close();

      audioContextRef.current?.close();
    } catch (error) {
      console.error(
        "Voice cleanup error:",
        error
      );
    }

    processorRef.current = null;

    sourceRef.current = null;

    silentGainRef.current = null;

    streamRef.current = null;

    sessionRef.current = null;

    audioContextRef.current = null;

    stopAudioPlayback();

    isMutedRef.current =
      false;

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

    if (
      sessionRef.current ||
      streamRef.current
    ) {
      console.log(
        "Voice session already active."
      );

      return;
    }

    try {
      isConnectingRef.current =
        true;

      setError("");

      setCanReconnect(false);

      // Start a fresh live transcript
      currentStudentTranscriptRef.current =
        "";

      currentEduMateTranscriptRef.current =
        "";

      setStudentTranscript("");

      setEduMateTranscript("");

      clearGroundedTurnState();

      isMutedRef.current =
        false;

      setIsMuted(false);

      setStatus("connecting");

      // ----------------------------------------------
      // 1. Get secure ephemeral token
      // ----------------------------------------------

      const tokenResponse =
        await fetch(
          "/api/live/token"
        );

      if (!tokenResponse.ok) {
        const data =
          await tokenResponse.json();

        throw new Error(
          data.error ||
            "Failed to create voice session."
        );
      }

      const tokenData =
        await tokenResponse.json();

      // ----------------------------------------------
      // 2. Create Gemini client
      // ----------------------------------------------

      const ai =
        new GoogleGenAI({
          apiKey:
            tokenData.token,
          httpOptions: {
            apiVersion:
              "v1alpha",
          },
        });

      // ----------------------------------------------
      // 3. Create AudioContext
      // ----------------------------------------------

      const audioContext =
        new AudioContext({
          sampleRate: 16000,
        });

      audioContextRef.current =
        audioContext;

      await audioContext.resume();

      // ----------------------------------------------
      // 4. Request microphone
      // ----------------------------------------------

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          }
        );

      streamRef.current =
        stream;

      // ----------------------------------------------
      // 5. Connect to Gemini Live
      // ----------------------------------------------

      const session =
        await ai.live.connect({
          model:
            tokenData.model,

          config: {
            responseModalities: [
              Modality.AUDIO,
            ],

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
              console.log(
                "🎙️ Gemini Live connected"
              );

              isConnectingRef.current =
                false;

              setError("");

              setCanReconnect(false);

              setStatus(
                "listening"
              );
            },

            // ----------------------------------------
            // Gemini message
            // ----------------------------------------

            onmessage: async (
              message: any
            ) => {
              console.log(
                "Gemini Live message:",
                message
              );

              const serverContent =
                message.serverContent;

              if (!serverContent) {
                return;
              }

              // --------------------------------------
              // Student transcription
              // --------------------------------------

              const inputTranscription =
                serverContent.inputTranscription;

              if (
                inputTranscription?.text
              ) {
                // A new student turn starts after the previous grounded
                // response has completed. Reset only the per-turn state.
                if (
                  groundedResponseReceivedRef.current &&
                  !currentStudentTranscriptRef.current.trim()
                ) {
                  clearGroundedTurnState();
                }

                const text =
                  inputTranscription.text;

                currentStudentTranscriptRef.current +=
                  text;

                setStudentTranscript(
                  currentStudentTranscriptRef.current
                );
              }

              // --------------------------------------
              // EduMate transcription
              // --------------------------------------

              const outputTranscription =
                serverContent.outputTranscription;

              if (
                outputTranscription?.text
              ) {
                const text =
                  outputTranscription.text;

                // Never show the first Live response. It is an internal
                // draft used only to complete the Live turn. The student's
                // question is sent through RAG + Learning Memory first, and
                // only the grounded response is allowed into the UI.
                if (!groundedResponseRequestedRef.current) {
                  pendingEduMateTranscriptRef.current += text;
                  console.log(
                    "⏳ Holding initial EduMate response transcript.",
                  );
                } else {
                  currentEduMateTranscriptRef.current += text;

                  setEduMateTranscript(
                    currentEduMateTranscriptRef.current,
                  );
                }
              }

              // --------------------------------------
              // Completed turn
              // --------------------------------------

              if (serverContent.turnComplete) {
                const question =
                  currentStudentTranscriptRef.current.trim();

                if (
                  !waitingForGroundedResponseRef.current &&
                  !groundedResponseReceivedRef.current
                ) {
                  if (question && !pendingContextRef.current) {
                    pendingContextRef.current = true;
                    waitingForGroundedResponseRef.current = true;
                    pendingAudioQueueRef.current = [];
                    audioQueueRef.current = [];
                    pendingEduMateTranscriptRef.current = "";

                    void (async () => {
                      try {
                        let instruction = "";

                        if (isQuizStartRequest(question)) {
                          const topic = extractQuizTopic(question);
                          if (!topic) {
                            throw new Error(
                              "Please say the topic, for example: quiz me on photosynthesis."
                            );
                          }
                          const quiz = await generateVoiceQuiz(topic);
                          instruction = buildVoiceQuizInstruction(question, quiz);
                        } else if (activeQuizRef.current) {
                          if (quizBusyRef.current) {
                            console.log("🎯 Quiz answer is already being processed.");
                            return;
                          }

                          quizBusyRef.current = true;

                          const currentQuiz = activeQuizRef.current;
                          if (!currentQuiz) {
                            throw new Error("Active quiz was lost. Please start the quiz again.");
                          }

                          const result = await submitVoiceQuizAnswer(question);
                          const nextQuiz = await generateVoiceQuiz(currentQuiz.topic);

                          instruction = buildVoiceQuizResultInstruction(
                            question,
                            result,
                            nextQuiz,
                          );
                        } else {
                          const contextData = await fetchVoiceContext(question);
                          instruction = buildGroundedVoiceInstruction(question, contextData);
                        }

                        groundedResponseRequestedRef.current = true;
                        pendingContextRef.current = false;
                        quizBusyRef.current = false;

                        console.log("🧠 Sending grounded Voice Tutor instruction.");
                        sessionRef.current?.sendRealtimeInput({ text: instruction });
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
                  }
                  return;
                }

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

              if (
                serverContent.interrupted
              ) {
                console.log(
                  "🛑 Gemini response interrupted"
                );

                stopAudioPlayback();

                // Do not finalize incomplete
                // EduMate speech after interruption.
                currentEduMateTranscriptRef.current =
                  "";

                setEduMateTranscript("");

                setStatus(
                  "listening"
                );

                // Reset the current grounded-turn state after an interruption.
                clearGroundedTurnState();

                return;
              }

              // --------------------------------------
              // Model audio
              // --------------------------------------

              const modelTurn =
                serverContent.modelTurn;

              if (!modelTurn?.parts) {
                return;
              }

              for (
                const part of modelTurn.parts
              ) {
                const inlineData =
                  part.inlineData;

                if (
                  !inlineData?.data
                ) {
                  continue;
                }

                if (
                  inlineData.mimeType?.startsWith(
                    "audio/"
                  )
                ) {
                  const audioBuffer =
                    pcmToAudioBuffer(
                      audioContext,
                      inlineData.data
                    );

                  if (!groundedResponseRequestedRef.current) {
                    // Buffer ALL audio from the initial ungrounded Live
                    // response. This check must happen before turnComplete;
                    // otherwise the first response can already be audible.
                    pendingAudioQueueRef.current.push(audioBuffer);
                  } else {
                    // Once the grounded request has been sent, only this
                    // response is allowed to reach the speaker.
                    audioQueueRef.current.push(audioBuffer);
                    playNextAudio();
                  }
                }
              }
            },

            // ----------------------------------------
            // Error
            // ----------------------------------------

            onerror: (
              event: any
            ) => {
              console.error(
                "Gemini Live error:",
                event
              );

              isConnectingRef.current =
                false;

              setError(
                "Voice connection was interrupted. You can reconnect and continue."
              );

              cleanupVoiceResources();

              setCanReconnect(true);

              setStatus("error");
            },

            // ----------------------------------------
            // Connection closed
            // ----------------------------------------

            onclose: (
              event: any
            ) => {
              console.log(
                "Gemini Live closed:",
                event
              );

              isConnectingRef.current =
                false;

              cleanupVoiceResources();

              setCanReconnect(true);

              setStatus("error");

              setError(
                "Voice connection closed. You can reconnect and continue."
              );
            },
          },
        });

      sessionRef.current =
        session;

      // ----------------------------------------------
      // 6. Create microphone source
      // ----------------------------------------------

      const source =
        audioContext.createMediaStreamSource(
          stream
        );

      sourceRef.current =
        source;

      // ----------------------------------------------
      // 7. Create microphone processor
      // ----------------------------------------------

      const processor =
        audioContext.createScriptProcessor(
          4096,
          1,
          1
        );

      processorRef.current =
        processor;

      // ----------------------------------------------
      // 8. Send microphone audio to Gemini
      // ----------------------------------------------

      processor.onaudioprocess =
        (event) => {
          if (
            !sessionRef.current
          ) {
            return;
          }

          // Don't send microphone audio
          // when muted.
          if (
            isMutedRef.current
          ) {
            return;
          }

          const inputData =
            event.inputBuffer.getChannelData(
              0
            );

          const base64Audio =
            float32ToBase64PCM(
              inputData
            );

          sessionRef.current.sendRealtimeInput(
            {
              audio: {
                data: base64Audio,
                mimeType:
                  "audio/pcm;rate=16000",
              },
            }
          );
        };

      source.connect(
        processor
      );

      // ----------------------------------------------
      // Keep processor alive without sending
      // microphone audio to speakers.
      // ----------------------------------------------

      const silentGain =
        audioContext.createGain();

      silentGain.gain.value =
        0;

      silentGainRef.current =
        silentGain;

      processor.connect(
        silentGain
      );

      silentGain.connect(
        audioContext.destination
      );

      console.log(
        "🎤 Microphone streaming started"
      );
    } catch (err) {
      console.error(
        "Voice Tutor error:",
        err
      );

      isConnectingRef.current =
        false;

      cleanupVoiceResources();

      setError(
        err instanceof Error
          ? err.message
          : "Unable to start voice tutor."
      );

      setCanReconnect(true);

      setStatus("error");
    }
  }

  // --------------------------------------------------
  // Reconnect
  // --------------------------------------------------

  async function reconnectVoice() {
    console.log(
      "🔄 Reconnecting Voice Tutor..."
    );

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
    console.log(
      "🛑 Stopping Voice Tutor"
    );

    isConnectingRef.current =
      false;

    cleanupVoiceResources();

    currentStudentTranscriptRef.current =
      "";

    currentEduMateTranscriptRef.current =
      "";

    setStudentTranscript("");

    setEduMateTranscript("");

    clearGroundedTurnState();

    setCanReconnect(false);

    setError("");

    setStatus("idle");
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">

      {/* ------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------ */}

      <div className="flex items-center justify-between">

        <div>
          <h2 className="text-lg font-semibold">
            🎙️ EduMate Voice Tutor
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Talk to EduMate using your voice.
          </p>
        </div>

        {/* Animated indicator */}
        <div className="relative flex h-12 w-12 items-center justify-center">

          {status === "listening" && (
            <>
              <span className="absolute h-10 w-10 animate-ping rounded-full bg-blue-300 opacity-50" />

              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-xl">
                🎤
              </span>
            </>
          )}

          {status === "speaking" && (
            <>
              <span className="absolute h-10 w-10 animate-pulse rounded-full bg-green-300 opacity-60" />

              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-xl">
                🔊
              </span>
            </>
          )}

          {status === "connecting" && (
            <span className="flex h-10 w-10 animate-pulse items-center justify-center rounded-full bg-yellow-100 text-xl">
              ⏳
            </span>
          )}

          {status === "error" && (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-xl">
              ⚠️
            </span>
          )}

          {status === "idle" && (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl">
              💬
            </span>
          )}

        </div>
      </div>

      {/* ------------------------------------------ */}
      {/* Status */}
      {/* ------------------------------------------ */}

      <div
        className={`mt-5 rounded-xl p-4 text-center ${
          status === "error"
            ? "bg-red-50"
            : isMuted
              ? "bg-red-50"
              : status === "speaking"
                ? "bg-green-50"
                : status === "listening"
                  ? "bg-blue-50"
                  : "bg-gray-50"
        }`}
      >
        <p className="font-medium">

          {status === "idle" &&
            "Ready to talk"}

          {status === "connecting" &&
            "⏳ Connecting to EduMate..."}

          {status === "listening" &&
            !isMuted &&
            "🎤 Listening..."}

          {status === "listening" &&
            isMuted &&
            "🔇 Microphone muted"}

          {status === "speaking" &&
            "🔊 EduMate is speaking..."}

          {status === "error" &&
            "⚠️ Voice connection needs attention"}

        </p>
      </div>

      {/* ------------------------------------------ */}
      {/* Error */}
      {/* ------------------------------------------ */}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ------------------------------------------ */}
      {/* Live Transcripts */}
      {/* ------------------------------------------ */}

      {(studentTranscript ||
        eduMateTranscript ||
        status === "listening" ||
        status === "speaking") && (
        <div className="mt-5 space-y-3">

          {/* Student live transcript */}
          {studentTranscript && (
            <div className="rounded-xl border bg-blue-50 p-4">

              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg">
                  🧑‍🎓
                </span>

                <span className="font-semibold text-gray-800">
                  You
                </span>
              </div>

              <p className="text-sm text-gray-700">
                {studentTranscript}
              </p>
            </div>
          )}

          {/* EduMate live transcript */}
          {eduMateTranscript && (
            <div className="rounded-xl border bg-gray-50 p-4">

              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg">
                  🤖
                </span>

                <span className="font-semibold text-gray-800">
                  EduMate
                </span>
              </div>

              <p className="text-sm text-gray-700">
                {eduMateTranscript}
              </p>
            </div>
          )}

        </div>
      )}

      {/* ------------------------------------------ */}
      {/* Conversation History */}
      {/* ------------------------------------------ */}

      {conversation.length > 0 && (
        <div className="mt-5">

          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">
              📝 Conversation
            </h3>

            <span className="text-xs text-gray-500">
              {conversation.length}{" "}
              {conversation.length === 1
                ? "message"
                : "messages"}
            </span>
          </div>

          <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border bg-gray-50 p-3">

            {conversation.map(
              (message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${
                    message.role ===
                    "student"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role ===
                      "student"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-800 shadow-sm"
                    }`}
                  >

                    <div className="mb-1 text-xs font-semibold opacity-80">
                      {message.role ===
                      "student"
                        ? "🧑‍🎓 You"
                        : "🤖 EduMate"}
                    </div>

                    <p className="text-sm leading-relaxed">
                      {message.text}
                    </p>

                  </div>

                </div>
              )
            )}

          </div>
        </div>
      )}

      {/* ------------------------------------------ */}
      {/* Controls */}
      {/* ------------------------------------------ */}

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">

        {/* Idle */}
        {status === "idle" && (
          <button
            onClick={startVoice}
            className="rounded-full bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            🎤 Start Voice Tutor
          </button>
        )}

        {/* Connecting */}
        {status === "connecting" && (
          <button
            disabled
            className="cursor-not-allowed rounded-full bg-gray-300 px-6 py-3 font-semibold text-gray-600"
          >
            ⏳ Connecting...
          </button>
        )}

        {/* Active */}
        {(status === "listening" ||
          status === "speaking") && (
          <>
            {/* Mute */}
            <button
              onClick={toggleMute}
              className={`rounded-full px-5 py-3 font-semibold transition ${
                isMuted
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {isMuted
                ? "🔊 Unmute"
                : "🔇 Mute"}
            </button>

            {/* Stop */}
            <button
              onClick={stopVoice}
              className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700"
            >
              ⏹ Stop Voice Tutor
            </button>
          </>
        )}

        {/* Error */}
        {status === "error" && (
          <>
            {canReconnect && (
              <button
                onClick={
                  reconnectVoice
                }
                className="rounded-full bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                🔄 Reconnect
              </button>
            )}

            <button
              onClick={stopVoice}
              className="rounded-full bg-gray-200 px-6 py-3 font-semibold text-gray-800 transition hover:bg-gray-300"
            >
              ✕ Close
            </button>
          </>
        )}

      </div>

      {/* ------------------------------------------ */}
      {/* Help text */}
      {/* ------------------------------------------ */}

      {status !== "idle" &&
        status !== "error" && (
          <p className="mt-3 text-center text-xs text-gray-500">
            {isMuted
              ? "🔇 Your microphone is muted. EduMate can still speak."
              : "🎤 You can interrupt EduMate or mute your microphone anytime."}
          </p>
        )}

    </div>
  );
}