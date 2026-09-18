"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { AuthShell } from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError(
            "This password reset link is invalid or has expired. Please request a new one.",
          );
        }
      } catch (error) {
        console.error("Reset session check error:", error);
        setError("Unable to verify the password reset session.");
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleUpdatePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMessage("Your password has been updated successfully.");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (error) {
      console.error("Password update error:", error);
      setError(
        error instanceof Error ? error.message : "Unable to update password.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="auth-screen">
        <div className="auth-loading">Verifying reset link...</div>
      </main>
    );
  }

  return (
    <AuthShell
      title="New password"
      subtitle="Choose a secure password to continue."
      footer={
        <div className="auth-footer-copy">
          <Link href="/forgot-password">Request a new reset link</Link>
        </div>
      }
    >
      {error && !password && !confirmPassword ? (
        <div className="auth-message auth-message--error">{error}</div>
      ) : (
        <form onSubmit={handleUpdatePassword} className="auth-form">
          <div className="auth-field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a new password"
              minLength={6}
              required
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              minLength={6}
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
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
