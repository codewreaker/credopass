import { describe, it, expect } from "bun:test";

describe("Example Test Suite", () => {
  it("should add two numbers correctly", () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });

  it("should handle string concatenation", () => {
    const str = "Hello" + " " + "World";
    expect(str).toBe("Hello World");
  });

  it("should verify array includes a value", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr).toContain(3);
  });
});
