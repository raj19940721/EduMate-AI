"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { AuthShell } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResetRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );

      if (error) throw error;

      setMessage(
        "Password reset link has been sent to your email. Please check your inbox.",
      );
    } catch (error) {
      console.error("Password reset request error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to send password reset email.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your email to receive a secure reset link."
      footer={
        <div className="auth-footer-copy">
          <Link href="/login">← Back to login</Link>
        </div>
      }
    >
      <form onSubmit={handleResetRequest} className="auth-form">
        <div className="auth-field">
          <label htmlFor="reset-email">Email</label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
          />
        </div>

        {error && (
          <div className="auth-message auth-message--error">{error}</div>
        )}
        {message && (
          <div className="auth-message auth-message--success">{message}</div>
        )}

        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
    </AuthShell>
  );
}
