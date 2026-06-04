"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

const initialForm = { username: "", password: "" };

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(apiUrl("/api/auth/me"), {
          credentials: "include",
        });
        if (response.ok) {
          router.replace("/");
        }
      } catch {
        // If auth check fails, stay on login page.
      }
    };

    checkSession();
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
        }),
      });

      if (!response.ok) {
        setError("Invalid username or password.");
        return;
      }

      router.push("/");
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[720px] flex-col justify-center gap-8 px-6 py-16">
        <header className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Welcome back
          </p>
          <h1 className="font-display text-4xl font-semibold text-[var(--navy-dark)]">
            Kanban Studio
          </h1>
          <p className="text-sm leading-6 text-[var(--gray-text)]">
            Sign in to keep your board in sync.
          </p>
        </header>

        <section className="rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Username
              <input
                type="text"
                value={form.username}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, username: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                placeholder="user"
                autoComplete="username"
                required
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                placeholder="password"
                autoComplete="current-password"
                required
              />
            </label>

            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-[rgba(236,173,10,0.45)] bg-[rgba(236,173,10,0.12)] px-4 py-3 text-sm text-[var(--navy-dark)]"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Signing in" : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
