"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] =
    useState(true);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase =
          createSupabaseBrowserClient();

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError(
            "This password reset link is invalid or has expired. Please request a new one."
          );
        }
      } catch (error) {
        console.error(
          "Reset session check error:",
          error
        );

        setError(
          "Unable to verify the password reset session."
        );
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleUpdatePassword = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters long."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase =
        createSupabaseBrowserClient();

      const { error } =
        await supabase.auth.updateUser({
          password,
        });

      if (error) {
        throw error;
      }

      setMessage(
        "Your password has been updated successfully."
      );

      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (error) {
      console.error(
        "Password update error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to update password."
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-600">
            Verifying reset link...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold">
          Reset Password
        </h1>

        <p className="mt-2 text-gray-500">
          Enter your new password below.
        </p>

        {error &&
          !password &&
          !confirmPassword && (
            <div className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}

              <div className="mt-3">
                <Link
                  href="/forgot-password"
                  className="font-medium text-blue-600 hover:underline"
                >
                  Request a new reset link
                </Link>
              </div>
            </div>
          )}

        {!error ||
        password ||
        confirmPassword ? (
          <form
            onSubmit={handleUpdatePassword}
            className="mt-8 space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-medium">
                New Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
                disabled={loading}
                minLength={6}
                className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 disabled:bg-gray-100"
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Confirm Password
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                required
                disabled={loading}
                minLength={6}
                className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 disabled:bg-gray-100"
                placeholder="Confirm new password"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </p>
            )}

            {message && (
              <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
            >
              {loading
                ? "Updating..."
                : "Update Password"}
            </button>
          </form>
        ) : null}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}