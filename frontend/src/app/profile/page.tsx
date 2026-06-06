"use client";

import { useEffect, useState } from "react";
import { getMe, updateProfile, postLogout } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((user) => {
        setUsername(user.username);
        setEmail(user.email ?? "");
        setIsLoading(false);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      await updateProfile({ email: email || undefined });
      setStatus({ type: "success", message: "Email updated." });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }
    try {
      await updateProfile({ currentPassword, password: newPassword });
      setStatus({ type: "success", message: "Password changed." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    }
  };

  const handleLogout = async () => {
    await postLogout();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--gray-text)]">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">Account</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--navy-dark)]">{username}</h1>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
          >
            Back to board
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--navy-dark)] transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
          >
            Log out
          </button>
        </div>
      </div>

      {status && (
        <div
          className={`rounded-2xl px-5 py-3 text-sm ${
            status.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
          data-testid="profile-status"
        >
          {status.message}
        </div>
      )}

      {/* Email section */}
      <form
        onSubmit={handleSaveEmail}
        className="rounded-[24px] border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)] space-y-4"
      >
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]">Email</h2>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          data-testid="email-input"
        />
        <button
          type="submit"
          className="rounded-full bg-[var(--primary-blue)] px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white transition hover:brightness-110"
          data-testid="save-email-btn"
        >
          Save email
        </button>
      </form>

      {/* Password section */}
      <form
        onSubmit={handleChangePassword}
        className="rounded-[24px] border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)] space-y-4"
      >
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]">Change password</h2>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          required
          className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          data-testid="current-password-input"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (min 6 chars)"
          required
          className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          data-testid="new-password-input"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          required
          className="w-full rounded-xl border border-[var(--stroke)] px-3 py-2.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          data-testid="confirm-password-input"
        />
        <button
          type="submit"
          className="rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white transition hover:brightness-110"
          data-testid="change-password-btn"
        >
          Change password
        </button>
      </form>
    </main>
  );
}
