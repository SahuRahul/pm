"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

type AuthGuardProps = {
  children: React.ReactNode;
};

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isActive = true;
    const checkSession = async () => {
      try {
        const response = await fetch(apiUrl("/api/auth/me"), {
          credentials: "include",
        });
        if (!isActive) {
          return;
        }
        if (response.ok) {
          setIsAuthed(true);
        } else {
          router.replace("/login");
        }
      } catch {
        if (isActive) {
          router.replace("/login");
        }
      } finally {
        if (isActive) {
          setIsChecking(false);
        }
      }
    };

    checkSession();

    return () => {
      isActive = false;
    };
  }, [router]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
        Checking session
      </div>
    );
  }

  if (!isAuthed) {
    return null;
  }

  return <>{children}</>;
};
