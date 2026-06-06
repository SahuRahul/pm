"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postRegister, postLogin } from "@/lib/api";

const initialForm = { username: "", password: "", email: "" };

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await postRegister(form.username.trim(), form.password, form.email.trim() || undefined);
      await postLogin(form.username.trim(), form.password);
      router.push("/");
    } catch (err) {
      setError((err as Error).message || "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[480px] flex-col justify-center gap-8 px-6 py-16">
        <header className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Get started
          </p>
          <h1 className="font-display text-4xl font-semibold text-[var(--navy-dark)]">
            Create account
          </h1>
          <p className="text-sm leading-6 text-[var(--gray-text)]">
            Start managing your work with Kanban Studio.
          </p>
        </header>

        <section className="rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Username
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                placeholder="min 3 characters"
                autoComplete="username"
                required
                minLength={3}
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Email <span className="normal-case font-normal">(optional)</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                placeholder="min 6 characters"
                autoComplete="new-password"
                required
                minLength={6}
              />
            </label>

            {error && (
              <p role="alert" className="rounded-xl border border-[rgba(236,173,10,0.45)] bg-[rgba(236,173,10,0.12)] px-4 py-3 text-sm text-[var(--navy-dark)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[var(--gray-text)]">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[var(--primary-blue)] hover:underline">
              Sign in
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
