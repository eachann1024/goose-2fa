import { describe, it, expect } from "vitest";
import { formatCode } from "../otp";

describe("formatCode", () => {
  it("应该将 6 位验证码格式化为 3+3", () => {
    expect(formatCode("123456")).toBe("123 456");
  });

  it("应该将 8 位验证码格式化为 4+4", () => {
    expect(formatCode("12345678")).toBe("1234 5678");
  });

  it("其他长度的验证码保持不变", () => {
    expect(formatCode("12345")).toBe("12345");
    expect(formatCode("1234567")).toBe("1234567");
    expect(formatCode("")).toBe("");
  });
});
