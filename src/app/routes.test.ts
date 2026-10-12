import { expect, test } from "vitest";
import { routeErrorPaths } from "./routes";
test("error routes are unique and include recovery states", () => {
  expect(new Set(routeErrorPaths).size).toBe(routeErrorPaths.length);
  expect(routeErrorPaths).toContain("offline");
  expect(routeErrorPaths).toContain("timeout");
});
