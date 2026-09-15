"use client";

import { useRef, useState } from "react";
import { GoogleGenAI, Modality } from "@google/genai";

type VoiceStatus = "idle" | "connecting" | "listening" | "speaking";

export default function VoiceTutor() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState("");

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
  // Gemini audio = 24kHz, mono, 16-bit PCM
  // --------------------------------------------------

  function pcmToAudioBuffer(audioContext: AudioContext, base64Data: string) {
    // FIX:
    // Use base64Data instead of undefined "base64"
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
  // Stop currently playing / queued Gemini audio
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
  // Start Voice Tutor
  // --------------------------------------------------

  async function startVoice() {
    try {
      setError("");
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

          inputAudioTranscription: {},

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
          // ------------------------------------------
          // Gemini connection opened
          // ------------------------------------------

          onopen: () => {
            console.log("🎙️ Gemini Live connected");

            setStatus("listening");
          },

          // ------------------------------------------
          // Gemini message
          // ------------------------------------------

          onmessage: async (message: any) => {
            console.log("Gemini Live message:", message);

            const serverContent = message.serverContent;

            if (!serverContent) {
              return;
            }

            // ----------------------------------------
            // Gemini response interrupted
            // ----------------------------------------

            if (serverContent.interrupted) {
              console.log("🛑 Gemini response interrupted");

              stopAudioPlayback();

              setStatus("listening");

              return;
            }

            // ----------------------------------------
            // Model audio
            // ----------------------------------------

            const modelTurn = serverContent.modelTurn;

            if (!modelTurn?.parts) {
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

                audioQueueRef.current.push(audioBuffer);

                playNextAudio();
              }
            }
          },

          // ------------------------------------------
          // Error
          // ------------------------------------------

          onerror: (event: any) => {
            console.error("Gemini Live error:", event);

            setError("Voice connection error. Please try again.");

            setStatus("idle");
          },

          // ------------------------------------------
          // Connection closed
          // ------------------------------------------

          onclose: (event: any) => {
            console.log("Gemini Live closed:", event);

            setStatus("idle");
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
      // Important:
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

      setError(
        err instanceof Error ? err.message : "Unable to start voice tutor.",
      );

      stopVoice();
    }
  }

  // --------------------------------------------------
  // Stop Voice Tutor
  // --------------------------------------------------

  function stopVoice() {
    console.log("🛑 Stopping Voice Tutor");

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
      console.error("Error stopping voice:", error);
    }

    processorRef.current = null;
    sourceRef.current = null;
    silentGainRef.current = null;
    streamRef.current = null;
    sessionRef.current = null;
    audioContextRef.current = null;

    stopAudioPlayback();

    setStatus("idle");
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">🎙️ EduMate Voice Tutor</h2>

          <p className="mt-1 text-sm text-gray-600">
            Talk to EduMate using your voice.
          </p>
        </div>

        <div className="text-2xl">
          {status === "listening" && "🎤"}

          {status === "speaking" && "🔊"}

          {status === "connecting" && "⏳"}

          {status === "idle" && "💬"}
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-gray-50 p-4 text-center">
        <p className="font-medium">
          {status === "idle" && "Ready to talk"}

          {status === "connecting" && "Connecting to EduMate..."}

          {status === "listening" && "🎤 Listening..."}

          {status === "speaking" && "🔊 EduMate is speaking..."}
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5 flex justify-center">
        {status === "idle" ? (
          <button
            onClick={startVoice}
            className="rounded-full bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            🎤 Start Voice Tutor
          </button>
        ) : (
          <button
            onClick={stopVoice}
            className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
          >
            ⏹ Stop Voice Tutor
          </button>
        )}
      </div>
    </div>
  );
}
