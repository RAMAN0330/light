import { render } from "@testing-library/react";
import { expect, it } from "vitest";

import { Card } from "./card";

it("renders the subtle card variant with One Dark surface tokens", () => {
  const { getByText } = render(<Card variant="subtle">Content</Card>);

  expect(getByText("Content")).toHaveClass(
    "bg-[#21252b]",
    "border-[#3e4451]",
  );
});
