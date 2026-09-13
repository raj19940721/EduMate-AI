export interface GuardrailResult {
  allowed: boolean;
  message?: string;
  reason?: string;
}

const promptInjectionPatterns = [
  /ignore previous instructions/i,
  /ignore all previous instructions/i,
  /reveal your system prompt/i,
  /show me your system prompt/i,
  /reveal your instructions/i,
  /show me your hidden prompt/i,
  /ignore your instructions/i,
];

const unsafePatterns = [
  /how to make a bomb/i,
  /how to make explosives/i,
  /how to build a weapon/i,
  /how to hurt someone/i,
  /how to kill someone/i,
];

export function checkGuardrails(
  question: string,
): GuardrailResult {
  const normalizedQuestion =
    question.trim();

  // 1. Empty question
  if (!normalizedQuestion) {
    return {
      allowed: false,
      reason: "empty_question",
      message: "Please enter a question.",
    };
  }

  // 2. Prompt injection
  for (const pattern of promptInjectionPatterns) {
    if (pattern.test(normalizedQuestion)) {
      return {
        allowed: false,
        reason: "prompt_injection",
        message:
          "I can help with educational questions, but I can't reveal internal instructions or system information.",
      };
    }
  }

  // 3. Unsafe requests
  for (const pattern of unsafePatterns) {
    if (pattern.test(normalizedQuestion)) {
      return {
        allowed: false,
        reason: "unsafe_request",
        message:
          "I can't help with instructions for harming people or making weapons. Please ask me an educational question instead.",
      };
    }
  }

  // 4. Question is allowed
  return {
    allowed: true,
  };
}