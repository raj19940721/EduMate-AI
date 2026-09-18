"use client";

import { useRef, useState } from "react";

interface HomeworkResult {
  subject: string;
  topic: string;
  explanation: string;
  steps: string[];
  finalAnswer: string;
  hint: string;
}

type HomeworkMode = "explain" | "hint" | "check";

export default function HomeworkHelper() {
  const [question, setQuestion] = useState("");
  const [subject, setSubject] = useState("Science");
  const [detectedSubject, setDetectedSubject] = useState("");
  const [grade] = useState("3");
  const [mode, setMode] = useState<HomeworkMode>("explain");

  const [result, setResult] = useState<HomeworkResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const [error, setError] = useState("");
  const [imageName, setImageName] = useState("");

  // --------------------------------
  // Multiple file questions
  // --------------------------------
  const [imageQuestions, setImageQuestions] = useState<string[]>([]);

  const [selectedImageQuestion, setSelectedImageQuestion] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --------------------------------
  // Solve homework question
  // --------------------------------

  async function solveHomework(
    homeworkQuestion: string,
    selectedMode: HomeworkMode = "explain",
    detectedSubject?: string,
  ) {
    if (!homeworkQuestion.trim()) {
      setError("Please provide a homework question.");
      return;
    }

    const normalizedQuestion = homeworkQuestion.trim();

    if (normalizedQuestion.length > 5000) {
      setError("Please keep the homework question under 5,000 characters.");
      return;
    }

    const selectedSubject = (
      detectedSubject !== undefined ? detectedSubject : subject
    )
      .trim()
      .slice(0, 100);

    const selectedGrade = Number(grade);

    if (
      !Number.isInteger(selectedGrade) ||
      selectedGrade < 1 ||
      selectedGrade > 12
    ) {
      setError("Please select a valid grade.");
      return;
    }

    setMode(selectedMode);
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/homework", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: normalizedQuestion,
          subject: selectedSubject,
          grade: selectedGrade,
          mode: selectedMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || "Failed to get homework help.");
        return;
      }

      if (data.blocked) {
        setError(data.message || "I can't help with that request.");
        return;
      }

      setResult(data.homework);
    } catch (error) {
      console.error("Homework request error:", error);

      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------
  // Typed homework
  // --------------------------------

  async function handleSubmit(selectedMode: HomeworkMode) {
    await solveHomework(question, selectedMode);
  }

  // --------------------------------
  // Image / PDF upload
  // --------------------------------

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedImageTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);

    const isPdf = file.type === "application/pdf";
    const isImage = allowedImageTypes.has(file.type);

    // --------------------------------
    // Validate file type
    // --------------------------------

    if (!isPdf && !isImage) {
      setError("Please upload an image or PDF file.");

      event.target.value = "";
      return;
    }

    // --------------------------------
    // Validate file size
    // --------------------------------

    if (file.size <= 0) {
      setError("The selected file is empty.");
      event.target.value = "";
      return;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      setError("File is too large. Please upload a file smaller than 10 MB.");

      event.target.value = "";
      return;
    }

    setImageName(file.name);
    setImageLoading(true);
    setLoading(false);
    setError("");
    setResult(null);

    setImageQuestions([]);
    setSelectedImageQuestion("");
    setDetectedSubject("");

    try {
      // --------------------------------
      // Create FormData
      // --------------------------------

      const formData = new FormData();

      // PDF API expects "pdf"
      // Image API expects "image"
      formData.append(isPdf ? "pdf" : "image", file);

      // --------------------------------
      // Select correct API
      // --------------------------------

      const apiEndpoint = isPdf ? "/api/homework/pdf" : "/api/homework/image";

      const response = await fetch(apiEndpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      // --------------------------------
      // API error
      // --------------------------------

      if (!response.ok) {
        setError(
          data.error ||
            data.message ||
            `Failed to read homework ${isPdf ? "PDF" : "image"}.`,
        );

        return;
      }

      // --------------------------------
      // Guardrail blocked
      // --------------------------------

      if (data.blocked) {
        setError(data.message || "I can't help with that request.");

        return;
      }

      const homework = data.homework;

      if (
        !homework ||
        typeof homework !== "object" ||
        !Array.isArray(homework.questions)
      ) {
        setError(
          `The ${
            isPdf ? "PDF" : "image"
          } response was invalid. Please try again.`,
        );
        return;
      }

      // --------------------------------
      // Check file clarity
      // --------------------------------

      const fileIsClear = isPdf
        ? homework.pdfClear === true
        : homework.imageClear === true;

      if (!fileIsClear) {
        setError(
          homework.message ||
            `The ${
              isPdf ? "PDF" : "image"
            } is unclear. Please upload a clearer file.`,
        );

        return;
      }

      // --------------------------------
      // Check questions
      // --------------------------------

      // --------------------------------
      // Normalize extracted questions
      // --------------------------------

      const extractedQuestions = homework.questions
        .filter((item: unknown): item is string => typeof item === "string")
        .map((item: string) => item.trim())
        .filter(Boolean)
        .slice(0, 20);

      if (extractedQuestions.length === 0) {
        setError(
          `I couldn't find any homework questions in the ${
            isPdf ? "PDF" : "image"
          }.`,
        );
        return;
      }

      setImageQuestions(extractedQuestions);

      // --------------------------------
      // Store detected subject
      // --------------------------------

      const extractedSubject =
        typeof homework.subject === "string" &&
        homework.subject.trim() &&
        homework.subject.trim() !== "Unknown"
          ? homework.subject.trim().slice(0, 100)
          : subject;

      setDetectedSubject(extractedSubject);

      if (
        typeof homework.subject === "string" &&
        homework.subject.trim() &&
        homework.subject.trim() !== "Unknown"
      ) {
        setSubject(extractedSubject);
      }

      // --------------------------------
      // If only one question:
      // automatically solve it
      // --------------------------------

      if (homework.questions.length === 1) {
        const extractedQuestion = homework.questions[0];

        setQuestion(extractedQuestion);

        await solveHomework(extractedQuestion, "explain", detectedSubject);
      }
    } catch (error) {
      console.error(`Homework ${isPdf ? "PDF" : "image"} upload error:`, error);

      setError(
        `Something went wrong while reading the ${isPdf ? "PDF" : "image"}.`,
      );
    } finally {
      setImageLoading(false);
    }
  }

  // --------------------------------
  // Solve selected question
  // --------------------------------

  async function handleSolveSelectedQuestion() {
    if (!selectedImageQuestion) {
      setError("Please select a question first.");

      return;
    }

    setQuestion(selectedImageQuestion);

    await solveHomework(
      selectedImageQuestion,
      "explain",
      detectedSubject || subject,
    );
  }

  // --------------------------------
  // Clear
  // --------------------------------

  function clearHomework() {
    setQuestion("");
    setResult(null);
    setError("");
    setMode("explain");

    setImageName("");
    setImageQuestions([]);
    setSelectedImageQuestion("");
    setDetectedSubject("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="homework-helper">
      <div className="homework-helper__content">
        <div className="homework-helper__section">
          <label className="homework-helper__label">Homework Question</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Example: What is photosynthesis?"
            rows={4}
            className="homework-helper__textarea"
          />
        </div>

        <div className="homework-helper__upload">
          <div className="homework-helper__upload-header">
            <div>
              <p className="homework-helper__mini-title">
                📷📄 Have a homework file?
              </p>
              <p className="homework-helper__mini-copy">
                Upload a clear image or PDF of your homework.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageLoading || loading}
              className="homework-helper__upload-button"
            >
              {imageLoading ? "Reading File..." : "📷📄 Upload File"}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />

          {imageName && (
            <div className="homework-helper__file-pill">
              Selected file: <span>{imageName}</span>
            </div>
          )}
        </div>

        {imageQuestions.length > 1 && (
          <div className="homework-helper__question-list">
            <h3>📝 Questions Found</h3>

            <div className="homework-helper__question-options">
              {imageQuestions.map((imageQuestion, index) => (
                <label
                  key={index}
                  className={`homework-helper__question-option ${selectedImageQuestion === imageQuestion ? "is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="homework-question"
                    value={imageQuestion}
                    checked={selectedImageQuestion === imageQuestion}
                    onChange={() => setSelectedImageQuestion(imageQuestion)}
                    className="homework-helper__radio"
                  />

                  <span>
                    <span className="homework-helper__question-index">
                      {index + 1}.
                    </span>{" "}
                    {imageQuestion}
                  </span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSolveSelectedQuestion}
              disabled={!selectedImageQuestion || loading || imageLoading}
              className="homework-helper__solve-selected"
            >
              {loading ? "Solving..." : "🚀 Solve Selected Question"}
            </button>
          </div>
        )}

        <div className="homework-helper__form-grid">
          <div className="homework-helper__field">
            <label className="homework-helper__label">Subject</label>

            <select
              value={subject}
              onChange={(e) => {
                const newSubject = e.target.value;

                setSubject(newSubject);
                setDetectedSubject("");
                setResult(null);
                setError("");
              }}
              className="homework-helper__select"
            >
              <option value="Science">Science</option>
              <option value="Math">Math</option>
              <option value="English">English</option>
              <option value="Social Studies">Social Studies</option>
            </select>
          </div>

          <div className="homework-helper__field">
            <label className="homework-helper__label">Student Level</label>

            <div
              className="homework-helper__select flex items-center"
              aria-label={`Student level: Grade ${grade}`}
            >
              Grade {grade}
            </div>
          </div>
        </div>

        <div className="homework-helper__actions">
          <button
            type="button"
            onClick={() => handleSubmit("explain")}
            disabled={loading || imageLoading}
            className="homework-helper__action homework-helper__action--primary"
          >
            {loading && mode === "explain" ? "Thinking..." : "💡 Explain"}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit("hint")}
            disabled={loading || imageLoading}
            className="homework-helper__action homework-helper__action--warning"
          >
            {loading && mode === "hint" ? "Thinking..." : "🔍 Give Hint"}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit("check")}
            disabled={loading || imageLoading}
            className="homework-helper__action homework-helper__action--success"
          >
            {loading && mode === "check" ? "Checking..." : "✓ Check My Work"}
          </button>

          {(question ||
            result ||
            error ||
            imageName ||
            imageQuestions.length > 0) && (
            <button
              type="button"
              onClick={clearHomework}
              disabled={loading || imageLoading}
              className="homework-helper__action homework-helper__action--secondary"
            >
              Clear
            </button>
          )}
        </div>

        {error && <div className="homework-helper__alert">{error}</div>}

        {result && (
          <div className="homework-helper__result">
            <div className="homework-helper__result-header">
              <span className="homework-helper__tag homework-helper__tag--blue">
                {result.subject}
              </span>
              <span className="homework-helper__tag homework-helper__tag--purple">
                {result.topic}
              </span>
            </div>

            <h3 className="homework-helper__result-title">
              {mode === "explain"
                ? "💡 Explanation"
                : mode === "hint"
                  ? "🔍 Hint"
                  : "✓ Check My Work"}
            </h3>

            <div className="homework-helper__result-stack">
              <div className="homework-helper__panel">
                <p>{result.explanation}</p>
              </div>

              {result.steps.length > 0 && (
                <div className="homework-helper__panel">
                  <h4>Step-by-Step</h4>
                  <ol>
                    {result.steps.map((step, index) => (
                      <li key={`${step}-${index}`}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {result.hint && (
                <div className="homework-helper__panel homework-helper__panel--yellow">
                  <h4>Helpful Hint</h4>
                  <p>{result.hint}</p>
                </div>
              )}

              {result.finalAnswer && mode !== "hint" && (
                <div className="homework-helper__panel homework-helper__panel--green">
                  <h4>Final Answer</h4>
                  <p>{result.finalAnswer}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
