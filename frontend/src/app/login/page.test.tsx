import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import LoginPage from "@/app/login/page";

const push = vi.fn();
const replace = vi.fn();
const router = { push, replace };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
  });

  it("shows an error on invalid credentials", async () => {
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /invalid username or password/i
    );
  });

  it("redirects on successful login", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});
