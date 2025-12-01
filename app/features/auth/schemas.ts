import { z } from "zod";

/**
 * Shared password validation schema
 * Enforces:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 * - No repeated characters (3+ consecutive)
 * - No common patterns (12345678, password, qwerty, etc.)
 */
export const passwordSchema = z
  .string()
  .min(8, { message: "비밀번호는 최소 8자 이상이어야 합니다." })
  .regex(/[A-Z]/, { message: "영문 대문자를 최소 1개 이상 포함해야 합니다." })
  .regex(/[a-z]/, { message: "영문 소문자를 최소 1개 이상 포함해야 합니다." })
  .regex(/[0-9]/, { message: "숫자를 최소 1개 이상 포함해야 합니다." })
  .regex(/[^A-Za-z0-9]/, {
    message: "특수문자를 최소 1개 이상 포함해야 합니다.",
  })
  .refine((password) => !/(.)\1\1/.test(password), {
    message: "3자 이상 반복되는 문자는 사용할 수 없습니다.",
  })
  .refine(
    (password) => {
      const lowerPassword = password.toLowerCase();
      const simplePatterns = [
        "12345678",
        "password",
        "qwerty",
        "abcdefgh",
        "11111111", // Although caught by repeated chars, explicit check doesn't hurt
      ];
      return !simplePatterns.some((pattern) => lowerPassword.includes(pattern));
    },
    { message: "단순하거나 추측하기 쉬운 비밀번호는 사용할 수 없습니다." },
  );
