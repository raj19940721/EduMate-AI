"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { AuthShell } from "@/components/auth/AuthShell";

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

  const handleSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const studentName = name.trim();
      const studentEmail = email.trim();

      if (!studentName) throw new Error("Student name is required.");
      if (!studentEmail) throw new Error("Email is required.");
      if (password.length < 6)
        throw new Error("Password must be at least 6 characters.");

      const { data: authData, error: signupError } = await supabase.auth.signUp(
        {
          email: studentEmail,
          password,
          options: {
            data: {
              name: studentName,
              grade: Number(grade),
              age: Number(age),
            },
          },
        },
      );

      if (signupError) throw signupError;
      if (!authData.user) throw new Error("Unable to create user account.");

      if (authData.session) {
        router.push("/chat");
        router.refresh();
        return;
      }

      setSuccess(
        "Account created successfully. Please check your email to confirm your account, then sign in.",
      );
    } catch (error) {
      console.error("Signup error:", error);
      setError(error instanceof Error ? error.message : "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Set up a profile and start learning with confidence."
      footer={
        <div className="auth-footer-copy">
          <span>Already have an account?</span>
          <Link href="/login">Sign in</Link>
        </div>
      }
    >
      <form onSubmit={handleSignup} className="auth-form auth-form--wide">
        <div className="auth-field">
          <label htmlFor="signup-name">Student name</label>
          <input
            id="signup-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter student name"
            required
            disabled={loading}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            minLength={6}
            required
            disabled={loading}
          />
          <small>Must be at least 6 characters.</small>
        </div>

        <div className="auth-grid-two">
          <div className="auth-field">
            <label htmlFor="signup-grade">Grade</label>
            <select
              id="signup-grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              disabled={loading}
            >
              <option value="1">Grade 1</option>
              <option value="2">Grade 2</option>
              <option value="3">Grade 3</option>
              <option value="4">Grade 4</option>
              <option value="5">Grade 5</option>
            </select>
          </div>

          <div className="auth-field">
            <label htmlFor="signup-age">Age</label>
            <input
              id="signup-age"
              type="number"
              min={5}
              max={15}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Age"
              required
              disabled={loading}
            />
          </div>
        </div>

        {error && (
          <div className="auth-message auth-message--error">{error}</div>
        )}
        {success && (
          <div className="auth-message auth-message--success">{success}</div>
        )}

        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </AuthShell>
  );
}
