// @vitest-environment jsdom
import { type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import RenderBoundary from "./RenderBoundary";
afterEach(cleanup);
test("render failure shows safe 500 and Retry restores content", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let broken = true;
  function Reader(): ReactNode {
    if (broken) throw new Error("postgresql://private-password");
    return <p>История снова доступна</p>;
  }
  render(
    <MemoryRouter>
      <RenderBoundary>
        <Reader />
      </RenderBoundary>
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { name: "Не удалось загрузить данные" }),
  ).toBeTruthy();
  expect(screen.queryByText("postgresql://private-password")).toBeNull();
  broken = false;
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  expect(screen.getByText("История снова доступна")).toBeTruthy();
});
