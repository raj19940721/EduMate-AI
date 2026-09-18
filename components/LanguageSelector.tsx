"use client";

import { useState } from "react";

interface LanguageSelectorProps {
  value: string;
  onChange: (language: string) => void;
}

const languages = [
  {
    value: "en",
    label: "English",
  },
  {
    value: "te",
    label: "తెలుగు",
  },
  {
    value: "hi",
    label: "हिन्दी",
  },
];

export default function LanguageSelector({
  value,
  onChange,
}: LanguageSelectorProps) {
  const [saving, setSaving] = useState(false);

  async function handleChange(language: string) {
    const previousValue = value;

    onChange(language);
    setSaving(true);

    try {
      const response = await fetch("/api/student/language", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to save language");
      }
    } catch (error) {
      console.error("Failed to save language:", error);

      // Restore previous selection if saving fails.
      onChange(previousValue);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-slate-500 sm:inline">Language</span>

      <select
        value={value}
        onChange={(event) => void handleChange(event.target.value)}
        disabled={saving}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Preferred language"
      >
        {languages.map((language) => (
          <option key={language.value} value={language.value}>
            {language.label}
          </option>
        ))}
      </select>
    </div>
  );
}
