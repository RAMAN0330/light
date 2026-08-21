import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

const { signInWithSSO } = vi.hoisted(() => ({ signInWithSSO: vi.fn().mockResolvedValue({ error: null }) }));

vi.mock("../lib/supabase", () => ({ supabase: { auth: { signInWithSSO } } }));

import { AuthScreen } from "./AuthScreen";

afterEach(cleanup);

it("starts enterprise SSO using the entered work-email domain", async () => {
  render(<AuthScreen />);
  await userEvent.type(screen.getByLabelText("Email"), "person@acme.com");
  await userEvent.click(screen.getByRole("button", { name: "Continue with SSO" }));

  expect(signInWithSSO).toHaveBeenCalledWith({ domain: "acme.com" });
});

it("renders authentication as a dismissible dialog when opened from the landing page", async () => {
  const onClose = vi.fn();
  render(<AuthScreen onClose={onClose} />);

  expect(screen.getByRole("dialog", { name: "Welcome back" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Close sign in" }));
  expect(onClose).toHaveBeenCalledOnce();
});
