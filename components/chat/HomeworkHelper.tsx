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
  const [isOpen, setIsOpen] = useState(false);

  const [question, setQuestion] = useState("");
  const [subject, setSubject] = useState("Science");
  const [grade, setGrade] = useState("3");
  const [mode, setMode] =
    useState<HomeworkMode>("explain");

  const [result, setResult] =
    useState<HomeworkResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [imageName, setImageName] = useState("");

  // --------------------------------
  // Multiple file questions
  // --------------------------------
  const [imageQuestions, setImageQuestions] =
    useState<string[]>([]);

  const [
    selectedImageQuestion,
    setSelectedImageQuestion,
  ] = useState("");

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  // --------------------------------
  // Solve homework question
  // --------------------------------

  async function solveHomework(
    homeworkQuestion: string,
    selectedMode: HomeworkMode = "explain",
    detectedSubject?: string
  ) {
    if (!homeworkQuestion.trim()) {
      setError(
        "Please provide a homework question."
      );
      return;
    }

    setMode(selectedMode);
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        "/api/homework",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question:
              homeworkQuestion.trim(),
            subject:
              detectedSubject || subject,
            grade: Number(grade),
            mode: selectedMode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            data.message ||
            "Failed to get homework help."
        );
        return;
      }

      if (data.blocked) {
        setError(
          data.message ||
            "I can't help with that request."
        );
        return;
      }

      setResult(data.homework);
    } catch (error) {
      console.error(
        "Homework request error:",
        error
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------
  // Typed homework
  // --------------------------------

  async function handleSubmit(
    selectedMode: HomeworkMode
  ) {
    await solveHomework(
      question,
      selectedMode
    );
  }

  // --------------------------------
  // Image / PDF upload
  // --------------------------------

  async function handleFileUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const isPdf =
      file.type === "application/pdf";

    const isImage =
      file.type.startsWith("image/");

    // --------------------------------
    // Validate file type
    // --------------------------------

    if (!isPdf && !isImage) {
      setError(
        "Please upload an image or PDF file."
      );

      event.target.value = "";
      return;
    }

    // --------------------------------
    // Validate file size
    // --------------------------------

    const maxSize =
      10 * 1024 * 1024;

    if (file.size > maxSize) {
      setError(
        "File is too large. Please upload a file smaller than 10 MB."
      );

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

    try {
      // --------------------------------
      // Create FormData
      // --------------------------------

      const formData =
        new FormData();

      // PDF API expects "pdf"
      // Image API expects "image"
      formData.append(
        isPdf ? "pdf" : "image",
        file
      );

      // --------------------------------
      // Select correct API
      // --------------------------------

      const apiEndpoint = isPdf
        ? "/api/homework/pdf"
        : "/api/homework/image";

      const response = await fetch(
        apiEndpoint,
        {
          method: "POST",
          body: formData,
        }
      );

      const data =
        await response.json();

      // --------------------------------
      // API error
      // --------------------------------

      if (!response.ok) {
        setError(
          data.error ||
            data.message ||
            `Failed to read homework ${
              isPdf ? "PDF" : "image"
            }.`
        );

        return;
      }

      // --------------------------------
      // Guardrail blocked
      // --------------------------------

      if (data.blocked) {
        setError(
          data.message ||
            "I can't help with that request."
        );

        return;
      }

      const homework =
        data.homework;

      // --------------------------------
      // Check file clarity
      // --------------------------------

      const fileIsClear = isPdf
        ? homework.pdfClear
        : homework.imageClear;

      if (!fileIsClear) {
        setError(
          homework.message ||
            `The ${
              isPdf ? "PDF" : "image"
            } is unclear. Please upload a clearer file.`
        );

        return;
      }

      // --------------------------------
      // Check questions
      // --------------------------------

      if (
        !homework.questions ||
        homework.questions.length === 0
      ) {
        setError(
          `I couldn't find any homework questions in the ${
            isPdf ? "PDF" : "image"
          }.`
        );

        return;
      }

      // --------------------------------
      // Store all detected questions
      // --------------------------------

      setImageQuestions(
        homework.questions
      );

      // --------------------------------
      // Store detected subject
      // --------------------------------

      const detectedSubject =
        homework.subject &&
        homework.subject !== "Unknown"
          ? homework.subject
          : subject;

      if (
        homework.subject &&
        homework.subject !== "Unknown"
      ) {
        setSubject(
          homework.subject
        );
      }

      // --------------------------------
      // If only one question:
      // automatically solve it
      // --------------------------------

      if (
        homework.questions.length === 1
      ) {
        const extractedQuestion =
          homework.questions[0];

        setQuestion(
          extractedQuestion
        );

        await solveHomework(
          extractedQuestion,
          "explain",
          detectedSubject
        );
      }
    } catch (error) {
      console.error(
        `Homework ${
          isPdf ? "PDF" : "image"
        } upload error:`,
        error
      );

      setError(
        `Something went wrong while reading the ${
          isPdf ? "PDF" : "image"
        }.`
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
      setError(
        "Please select a question first."
      );

      return;
    }

    setQuestion(
      selectedImageQuestion
    );

    await solveHomework(
      selectedImageQuestion,
      "explain"
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

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  }

  return (
    <div className="border-t bg-white">
      {/* Header */}
      <button
        onClick={() =>
          setIsOpen(!isOpen)
        }
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50"
      >
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            📚 Homework Helper
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Get step-by-step help with
            your homework
          </p>
        </div>

        <span className="text-gray-500">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <div className="px-6 pb-6">
          {/* Homework Question */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Homework Question
            </label>

            <textarea
              value={question}
              onChange={(e) =>
                setQuestion(
                  e.target.value
                )
              }
              placeholder="Example: What is photosynthesis?"
              rows={4}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Image / PDF Upload */}
          <div className="mb-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  📷📄 Have a homework
                  file?
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Upload a clear image or
                  PDF of your homework.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={
                  imageLoading ||
                  loading
                }
                className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {imageLoading
                  ? "Reading File..."
                  : "📷📄 Upload File"}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={
                handleFileUpload
              }
              className="hidden"
            />

            {imageName && (
              <div className="mt-3 rounded-md bg-white px-3 py-2 text-xs text-gray-600">
                Selected file:{" "}
                <span className="font-medium">
                  {imageName}
                </span>
              </div>
            )}
          </div>

          {/* Multiple Questions */}
          {imageQuestions.length >
            1 && (
            <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-blue-900">
                📝 Questions Found
              </h3>

              <div className="space-y-2">
                {imageQuestions.map(
                  (
                    imageQuestion,
                    index
                  ) => (
                    <label
                      key={index}
                      className={`flex cursor-pointer gap-3 rounded-lg border bg-white p-3 transition ${
                        selectedImageQuestion ===
                        imageQuestion
                          ? "border-blue-500 ring-2 ring-blue-100"
                          : "border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="homework-question"
                        value={
                          imageQuestion
                        }
                        checked={
                          selectedImageQuestion ===
                          imageQuestion
                        }
                        onChange={() =>
                          setSelectedImageQuestion(
                            imageQuestion
                          )
                        }
                        className="mt-1"
                      />

                      <span className="text-sm leading-6 text-gray-700">
                        <span className="font-medium">
                          {index + 1}.
                        </span>{" "}
                        {imageQuestion}
                      </span>
                    </label>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={
                  handleSolveSelectedQuestion
                }
                disabled={
                  !selectedImageQuestion ||
                  loading ||
                  imageLoading
                }
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Solving..."
                  : "🚀 Solve Selected Question"}
              </button>
            </div>
          )}

          {/* Subject + Grade */}
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Subject
              </label>

              <select
                value={subject}
                onChange={(e) =>
                  setSubject(
                    e.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="Science">
                  Science
                </option>

                <option value="Math">
                  Math
                </option>

                <option value="English">
                  English
                </option>

                <option value="Social Studies">
                  Social Studies
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Grade
              </label>

              <select
                value={grade}
                onChange={(e) =>
                  setGrade(
                    e.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {Array.from(
                  { length: 12 },
                  (_, index) => {
                    const value =
                      index + 1;

                    return (
                      <option
                        key={value}
                        value={value}
                      >
                        Grade {value}
                      </option>
                    );
                  }
                )}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                handleSubmit(
                  "explain"
                )
              }
              disabled={
                loading ||
                imageLoading
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading &&
              mode === "explain"
                ? "Thinking..."
                : "💡 Explain"}
            </button>

            <button
              onClick={() =>
                handleSubmit("hint")
              }
              disabled={
                loading ||
                imageLoading
              }
              className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-800 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading &&
              mode === "hint"
                ? "Thinking..."
                : "🔍 Give Hint"}
            </button>

            <button
              onClick={() =>
                handleSubmit("check")
              }
              disabled={
                loading ||
                imageLoading
              }
              className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading &&
              mode === "check"
                ? "Checking..."
                : "✓ Check My Work"}
            </button>

            {(question ||
              result ||
              error ||
              imageName ||
              imageQuestions.length >
                0) && (
              <button
                onClick={
                  clearHomework
                }
                disabled={
                  loading ||
                  imageLoading
                }
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
              {/* Subject + Topic */}
              <div className="mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                    {result.subject}
                  </span>

                  <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                    {result.topic}
                  </span>
                </div>
              </div>

              {/* Explanation */}
              <div className="mb-5">
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  Explanation
                </h3>

                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                  {result.explanation}
                </p>
              </div>

              {/* Steps */}
              {result.steps.length >
                0 && (
                <div className="mb-5">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">
                    Step-by-Step
                  </h3>

                  <div className="space-y-2">
                    {result.steps.map(
                      (
                        step,
                        index
                      ) => (
                        <div
                          key={index}
                          className="flex gap-3 rounded-lg bg-white p-3"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                            {index + 1}
                          </div>

                          <p className="text-sm leading-6 text-gray-700">
                            {step}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Hint */}
              {result.hint && (
                <div className="mb-5 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <h3 className="mb-1 text-sm font-semibold text-yellow-900">
                    💡 Hint
                  </h3>

                  <p className="text-sm leading-6 text-yellow-800">
                    {result.hint}
                  </p>
                </div>
              )}

              {/* Final Answer */}
              {result.finalAnswer &&
                mode !== "hint" && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <h3 className="mb-1 text-sm font-semibold text-green-900">
                      Final Answer
                    </h3>

                    <p className="text-sm leading-6 text-green-800">
                      {result.finalAnswer}
                    </p>
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}