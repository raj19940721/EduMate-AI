"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [grade, setGrade] = useState("3");
  const [age, setAge] = useState("8");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignup = async (
    e: FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      // --------------------------------
      // Validate input
      // --------------------------------
      const studentName = name.trim();
      const studentEmail = email.trim();

      if (!studentName) {
        throw new Error("Student name is required.");
      }

      if (!studentEmail) {
        throw new Error("Email is required.");
      }

      if (password.length < 6) {
        throw new Error(
          "Password must be at least 6 characters.",
        );
      }

      // --------------------------------
      // Create Supabase Auth user
      // Student profile is created
      // automatically by DB trigger.
      // --------------------------------
      const {
        data: authData,
        error: signupError,
      } = await supabase.auth.signUp({
        email: studentEmail,
        password,
        options: {
          data: {
            name: studentName,
            grade: Number(grade),
            age: Number(age),
          },
        },
      });

      if (signupError) {
        throw signupError;
      }

      if (!authData.user) {
        throw new Error(
          "Unable to create user account.",
        );
      }

      // --------------------------------
      // If email confirmation is disabled
      // --------------------------------
      if (authData.session) {
        router.push("/chat");
        router.refresh();
        return;
      }

      // --------------------------------
      // Email confirmation enabled
      // --------------------------------
      setSuccess(
        "Account created successfully. Please check your email to confirm your account, then sign in.",
      );
    } catch (error) {
      console.error("Signup error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Signup failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            EduMate AI
          </h1>

          <p className="mt-2 text-gray-500">
            Create your learning profile
          </p>
        </div>

        {/* Signup Form */}
        <form
          onSubmit={handleSignup}
          className="mt-8 space-y-5"
        >
          {/* Student Name */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Student Name
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              required
              autoComplete="name"
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200 disabled:bg-gray-100"
              placeholder="Enter student name"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              autoComplete="email"
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200 disabled:bg-gray-100"
              placeholder="Enter email"
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
              minLength={6}
              autoComplete="new-password"
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200 disabled:bg-gray-100"
              placeholder="Create a password"
            />

            <p className="mt-1 text-xs text-gray-500">
              Password must be at least 6 characters.
            </p>
          </div>

          {/* Grade + Age */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Grade
              </label>

              <select
                value={grade}
                onChange={(e) =>
                  setGrade(e.target.value)
                }
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black focus:ring-2 focus:ring-gray-200 disabled:bg-gray-100"
              >
                <option value="1">
                  Grade 1
                </option>
                <option value="2">
                  Grade 2
                </option>
                <option value="3">
                  Grade 3
                </option>
                <option value="4">
                  Grade 4
                </option>
                <option value="5">
                  Grade 5
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Age
              </label>

              <input
                type="number"
                value={age}
                onChange={(e) =>
                  setAge(e.target.value)
                }
                required
                min={5}
                max={15}
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-black focus:ring-2 focus:ring-gray-200 disabled:bg-gray-100"
                placeholder="Age"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Creating account..."
              : "Create Account"}
          </button>
        </form>

        {/* Login */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="font-medium text-black hover:underline"
          >
            Sign In
          </button>
        </div>
      </div>
    </main>
  );
}