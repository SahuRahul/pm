import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { AuthGuard } from "@/components/AuthGuard";

const replace = vi.fn();
const router = { replace };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it("renders children when authenticated", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;

    render(
      <AuthGuard>
        <div>Private</div>
      </AuthGuard>
    );

    expect(await screen.findByText("Private")).toBeInTheDocument();
  });

  it("redirects to login when unauthenticated", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    render(
      <AuthGuard>
        <div>Private</div>
      </AuthGuard>
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
