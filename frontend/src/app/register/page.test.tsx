import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import RegisterPage from "./page";
import * as api from "@/lib/api";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders username, email, and password fields", () => {
    render(<RegisterPage />);
    expect(screen.getByPlaceholderText(/min 3 characters/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/min 6 characters/i)).toBeInTheDocument();
  });

  it("shows link to login page", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("submits registration and redirects on success", async () => {
    vi.spyOn(api, "postRegister").mockResolvedValue(undefined);
    vi.spyOn(api, "postLogin").mockResolvedValue(undefined);

    render(<RegisterPage />);
    await userEvent.type(screen.getByPlaceholderText(/min 3 characters/i), "newuser");
    await userEvent.type(screen.getByPlaceholderText(/min 6 characters/i), "securepass");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(api.postRegister).toHaveBeenCalledWith("newuser", "securepass", undefined);
    expect(api.postLogin).toHaveBeenCalledWith("newuser", "securepass");
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("shows error on registration failure", async () => {
    vi.spyOn(api, "postRegister").mockRejectedValue(new Error("Username already taken"));

    render(<RegisterPage />);
    await userEvent.type(screen.getByPlaceholderText(/min 3 characters/i), "takenuser");
    await userEvent.type(screen.getByPlaceholderText(/min 6 characters/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Username already taken");
  });

  it("includes email when provided", async () => {
    vi.spyOn(api, "postRegister").mockResolvedValue(undefined);
    vi.spyOn(api, "postLogin").mockResolvedValue(undefined);

    render(<RegisterPage />);
    await userEvent.type(screen.getByPlaceholderText(/min 3 characters/i), "newuser");
    await userEvent.type(screen.getByPlaceholderText(/you@example.com/i), "test@example.com");
    await userEvent.type(screen.getByPlaceholderText(/min 6 characters/i), "securepass");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(api.postRegister).toHaveBeenCalledWith("newuser", "securepass", "test@example.com");
  });
});
