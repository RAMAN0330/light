import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingPage } from "./LandingPage";

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => vi.unstubAllGlobals());

describe("LandingPage", () => {
  it("opens authentication from the primary action", async () => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<LandingPage onStart={onStart} />);

    await user.click(screen.getAllByRole("button", { name: "Get started" })[0]);

    expect(onStart).toHaveBeenCalledOnce();
  });

  it("offers sign out when opened from an authenticated workspace", async () => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    render(<LandingPage onStart={vi.fn()} onSignOut={onSignOut} />);
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
