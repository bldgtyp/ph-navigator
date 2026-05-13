import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { StatusDescription } from "./StatusDescription";

describe("StatusDescription", () => {
  test("does not render raw script tags from status descriptions", () => {
    const { container } = render(
      <StatusDescription description={"Before <script>alert('xss')</script> after"} />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/Before/)).toBeVisible();
    expect(screen.getByText(/after/)).toBeVisible();
  });

  test("does not render javascript protocol links as anchors", () => {
    const { container } = render(<StatusDescription description="[bad](javascript:alert(1))" />);

    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("bad")).toBeVisible();
  });

  test("renders external HTTPS links with tabnabbing protection", () => {
    render(<StatusDescription description="[PHI](https://passivehouse.com)" />);

    const link = screen.getByRole("link", { name: "PHI" });
    expect(link).toHaveAttribute("href", "https://passivehouse.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });

  test("does not render raw image tags", () => {
    const { container } = render(
      <StatusDescription description={'<img src="x" onerror="alert(1)">'} />,
    );

    expect(container.querySelector("img")).toBeNull();
  });

  test("renders the permitted inline Markdown elements", () => {
    render(<StatusDescription description="**bold** *italic* `psi`" />);

    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("italic").tagName).toBe("EM");
    expect(screen.getByText("psi").tagName).toBe("CODE");
  });
});
