"use client";

import { useState } from "react";

interface StudyModeResult {
  questionId: string;
  topic: string;
  subject: string;
  explanation: string;
  keyIdeas: string[];
  example: string;
  question: string;
  encouragement: string;
}

interface AnswerResult {
  evaluation: "correct" | "partial" | "incorrect";
  score: number;
  feedback: string;
  isCorrect: boolean;
}

interface Performance {
  topic: string;
  accuracy: number;
  masteryLevel: string;
  questionsAsked: number;
  correctAnswers: number;
  incorrectAnswers: number;
}

export default function StudyMode() {
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("Science");
  const [study, setStudy] = useState<StudyModeResult | null>(null);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAnswer, setCheckingAnswer] = useState(false);
  const [error, setError] = useState("");

  async function startStudy(studyTopic = topic, studySubject = subject) {
    const normalizedTopic = studyTopic.trim();

    if (!normalizedTopic) {
      setError("Please enter a topic to study.");
      return;
    }

    if (normalizedTopic.length > 200) {
      setError("Please keep the topic under 200 characters.");
      return;
    }

    setLoading(true);
    setError("");
    setStudy(null);
    setStudentAnswer("");
    setAnswerResult(null);
    setPerformance(null);

    try {
      const response = await fetch("/api/study-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: normalizedTopic,
          subject: studySubject.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || "Failed to start Study Mode.");
        return;
      }

      if (data.blocked) {
        setError(data.message || "I can't help with that request.");
        return;
      }

      const result = data.study;

      if (
        !result ||
        typeof result !== "object" ||
        typeof result.questionId !== "string" ||
        !result.questionId.trim() ||
        typeof result.explanation !== "string" ||
        !Array.isArray(result.keyIdeas) ||
        typeof result.example !== "string" ||
        typeof result.question !== "string" ||
        typeof result.encouragement !== "string"
      ) {
        setError("EduMate returned an invalid study response.");
        return;
      }

      const keyIdeas = result.keyIdeas
        .filter((item: unknown): item is string => typeof item === "string")
        .map((item: string) => item.trim())
        .filter(Boolean)
        .slice(0, 5);

      if (keyIdeas.length === 0) {
        setError("EduMate did not return any key ideas.");
        return;
      }

      setStudy({
        questionId: result.questionId.trim(),
        topic:
          typeof result.topic === "string" && result.topic.trim()
            ? result.topic.trim()
            : normalizedTopic,
        subject:
          typeof result.subject === "string" && result.subject.trim()
            ? result.subject.trim()
            : studySubject,
        explanation: result.explanation.trim(),
        keyIdeas,
        example: result.example.trim(),
        question: result.question.trim(),
        encouragement: result.encouragement.trim(),
      });

      setTopic(normalizedTopic);
      setSubject(studySubject);
    } catch (error) {
      console.error("Study Mode request error:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function checkAnswer() {
    if (!study) return;

    const normalizedAnswer = studentAnswer.trim();

    if (!normalizedAnswer) {
      setError("Please enter your answer first.");
      return;
    }

    if (normalizedAnswer.length > 1000) {
      setError("Please keep your answer under 1,000 characters.");
      return;
    }

    setCheckingAnswer(true);
    setError("");
    setAnswerResult(null);
    setPerformance(null);

    try {
      const response = await fetch("/api/study-mode/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: study.questionId,
          studentAnswer: normalizedAnswer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || "Failed to check your answer.");
        return;
      }

      if (
        !data.result ||
        typeof data.result.evaluation !== "string" ||
        typeof data.result.score !== "number" ||
        typeof data.result.feedback !== "string"
      ) {
        setError("EduMate returned an invalid answer response.");
        return;
      }

      setAnswerResult({
        evaluation: data.result.evaluation,
        score: data.result.score,
        feedback: data.result.feedback.trim(),
        isCorrect:
          data.result.isCorrect === true ||
          data.result.evaluation === "correct",
      });

      if (data.performance && typeof data.performance === "object") {
        setPerformance({
          topic:
            typeof data.performance.topic === "string"
              ? data.performance.topic
              : study.topic,
          accuracy:
            typeof data.performance.accuracy === "number"
              ? data.performance.accuracy
              : 0,
          masteryLevel:
            typeof data.performance.masteryLevel === "string"
              ? data.performance.masteryLevel
              : "learning",
          questionsAsked:
            typeof data.performance.questionsAsked === "number"
              ? data.performance.questionsAsked
              : 0,
          correctAnswers:
            typeof data.performance.correctAnswers === "number"
              ? data.performance.correctAnswers
              : 0,
          incorrectAnswers:
            typeof data.performance.incorrectAnswers === "number"
              ? data.performance.incorrectAnswers
              : 0,
        });
      }
    } catch (error) {
      console.error("Study Mode answer request error:", error);
      setError("Something went wrong while checking your answer.");
    } finally {
      setCheckingAnswer(false);
    }
  }

  async function nextQuestion() {
    if (!study) return;
    await startStudy(study.topic, study.subject);
  }

  function clearStudy() {
    setTopic("");
    setStudy(null);
    setStudentAnswer("");
    setAnswerResult(null);
    setPerformance(null);
    setError("");
  }

  return (
    <div className="study-mode">
      <div className="study-mode__content">
        <div className="study-mode__field">
          <label className="study-mode__label">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) {
                e.preventDefault();
                void startStudy();
              }
            }}
            placeholder="Example: Photosynthesis"
            maxLength={200}
            className="study-mode__input"
          />
        </div>

        <div className="study-mode__field">
          <label className="study-mode__label">Subject</label>
          <select
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setStudy(null);
              setStudentAnswer("");
              setAnswerResult(null);
              setPerformance(null);
              setError("");
            }}
            className="study-mode__input"
          >
            <option value="Science">Science</option>
            <option value="Math">Math</option>
            <option value="English">English</option>
            <option value="Social Studies">Social Studies</option>
          </select>
        </div>

        <div className="study-mode__actions">
          <button
            type="button"
            onClick={() => void startStudy()}
            disabled={loading || checkingAnswer}
            className="study-mode__action study-mode__action--primary"
          >
            {loading ? "Learning..." : "🚀 Start Learning"}
          </button>

          {(topic || study || error) && (
            <button
              type="button"
              onClick={clearStudy}
              disabled={loading || checkingAnswer}
              className="study-mode__action study-mode__action--secondary"
            >
              Clear
            </button>
          )}
        </div>

        {error && <div className="study-mode__alert">{error}</div>}

        {study && (
          <div className="study-mode__result">
            <div className="study-mode__result-header">
              <div className="study-mode__tag-row">
                <span className="study-mode__tag study-mode__tag--blue">
                  {study.subject}
                </span>
                <span className="study-mode__tag study-mode__tag--purple">
                  {study.topic}
                </span>
              </div>

              <h3 className="study-mode__result-title">📚 Let&apos;s Learn</h3>
            </div>

            <div className="study-mode__panel">
              <h4 className="study-mode__panel-title">📖 Explanation</h4>
              <p className="study-mode__panel-copy">{study.explanation}</p>
            </div>

            <div className="study-mode__panel study-mode__panel--stacked">
              <h4 className="study-mode__panel-title">💡 Key Ideas</h4>
              <div className="study-mode__ideas">
                {study.keyIdeas.map((idea, index) => (
                  <div key={`${idea}-${index}`} className="study-mode__idea">
                    <div className="study-mode__idea-check">✓</div>
                    <p>{idea}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="study-mode__panel study-mode__panel--purple">
              <h4 className="study-mode__panel-title">🌎 Example</h4>
              <p className="study-mode__panel-copy">{study.example}</p>
            </div>

            <div className="study-mode__panel study-mode__panel--yellow">
              <h4 className="study-mode__panel-title">🧠 Quick Check</h4>
              <p className="study-mode__panel-copy">{study.question}</p>

              {!answerResult && (
                <>
                  <textarea
                    value={studentAnswer}
                    onChange={(e) => {
                      setStudentAnswer(e.target.value);
                      setError("");
                    }}
                    placeholder="Type your answer here..."
                    maxLength={1000}
                    rows={3}
                    className="study-mode__textarea"
                  />

                  <button
                    type="button"
                    onClick={() => void checkAnswer()}
                    disabled={checkingAnswer || !studentAnswer.trim()}
                    className="study-mode__submit"
                  >
                    {checkingAnswer ? "Checking..." : "✅ Check Answer"}
                  </button>
                </>
              )}

              {answerResult && (
                <div className="study-mode__feedback">
                  <div className="study-mode__feedback-top">
                    <span
                      className={`study-mode__score-badge ${
                        answerResult.evaluation === "correct"
                          ? "is-correct"
                          : answerResult.evaluation === "partial"
                            ? "is-partial"
                            : "is-wrong"
                      }`}
                    >
                      {answerResult.evaluation === "correct"
                        ? "🎉 Correct"
                        : answerResult.evaluation === "partial"
                          ? "💡 Almost There"
                          : "🔄 Keep Practicing"}
                    </span>

                    <span className="study-mode__score">
                      Score: {answerResult.score}/100
                    </span>
                  </div>

                  <p className="study-mode__feedback-copy">
                    {answerResult.feedback}
                  </p>

                  {performance && (
                    <div className="study-mode__stats">
                      <div className="study-mode__stat">
                        <p>Accuracy</p>
                        <strong>{performance.accuracy}%</strong>
                      </div>
                      <div className="study-mode__stat">
                        <p>Mastery</p>
                        <strong>{performance.masteryLevel}</strong>
                      </div>
                      <div className="study-mode__stat">
                        <p>Questions</p>
                        <strong>{performance.questionsAsked}</strong>
                      </div>
                      <div className="study-mode__stat">
                        <p>Correct</p>
                        <strong>{performance.correctAnswers}</strong>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void nextQuestion()}
                    disabled={loading}
                    className="study-mode__next"
                  >
                    {loading ? "Loading..." : "➡️ Next Question"}
                  </button>
                </div>
              )}
            </div>

            {study.encouragement && (
              <div className="study-mode__panel study-mode__panel--green">
                <p className="study-mode__panel-copy">
                  🎉 {study.encouragement}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
