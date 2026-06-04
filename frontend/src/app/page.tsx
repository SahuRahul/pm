"use client";

import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { KanbanBoard } from "@/components/KanbanBoard";
import { apiUrl } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.push("/login");
    }
  };

  return (
    <AuthGuard>
      <KanbanBoard onLogout={handleLogout} />
    </AuthGuard>
  );
}
