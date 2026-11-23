import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Chip, EmptyState } from "@/components/ui";

describe("Chip", () => {
  it("renders text and tone styling together, never colour alone", () => {
    const markup = renderToStaticMarkup(<Chip tone="ai">Saran AI</Chip>);

    expect(markup).toContain("Saran AI");
    expect(markup).toContain("bg-ai-soft");
  });
});

describe("EmptyState", () => {
  it("renders an accessible empty state", () => {
    const markup = renderToStaticMarkup(
      <EmptyState title="Belum ada temuan" description="Temuan muncul setelah peninjauan manusia." />,
    );

    expect(markup).toContain("Belum ada temuan");
    expect(markup).toContain("Temuan muncul setelah peninjauan manusia.");
  });
});
