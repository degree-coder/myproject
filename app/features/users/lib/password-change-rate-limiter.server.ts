/**
 * Password Change Rate Limiter
 *
 * 비밀번호 변경 시도에 대한 요청 제한을 적용합니다.
 * 보안을 위해 일정 시간 내 시도 횟수를 제한하여 Brute Force 공격을 방지합니다.
 *
 * 제한 정책:
 * - 15분당 최대 5회 시도 허용
 * - 제한 초과 시 429 Too Many Requests 반환
 */
import { data } from "react-router";

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
}

// In-memory store (프로덕션에서는 Redis 사용 권장)
const rateLimitStore = new Map<string, RateLimitEntry>();

// 설정
const MAX_ATTEMPTS = 5; // 최대 시도 횟수
const WINDOW_MS = 15 * 60 * 1000; // 15분 (밀리초)

/**
 * 만료된 엔트리 정리
 * 메모리 누수 방지를 위해 주기적으로 호출
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.firstAttempt > WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Rate Limit 상태 확인 및 기록
 *
 * @param userId - 사용자 ID
 * @returns 남은 시도 횟수와 리셋 시간
 */
export function checkPasswordChangeRateLimit(userId: string): {
  allowed: boolean;
  remainingAttempts: number;
  resetTime: Date;
} {
  // 주기적으로 만료된 엔트리 정리 (10% 확률)
  if (Math.random() < 0.1) {
    cleanupExpiredEntries();
  }

  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  // 엔트리가 없거나 윈도우가 만료된 경우
  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
      resetTime: new Date(now + WINDOW_MS),
    };
  }

  // 제한 초과 여부 확인
  const allowed = entry.count < MAX_ATTEMPTS;
  const remainingAttempts = Math.max(0, MAX_ATTEMPTS - entry.count);
  const resetTime = new Date(entry.firstAttempt + WINDOW_MS);

  return { allowed, remainingAttempts, resetTime };
}

/**
 * 비밀번호 변경 시도 기록
 *
 * @param userId - 사용자 ID
 */
export function recordPasswordChangeAttempt(userId: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    // 새 윈도우 시작
    rateLimitStore.set(userId, {
      count: 1,
      firstAttempt: now,
    });
  } else {
    // 기존 윈도우에서 카운트 증가
    entry.count += 1;
  }
}

/**
 * Rate Limit 가드
 *
 * 비밀번호 변경 API에서 사용하는 가드 함수입니다.
 * 제한 초과 시 429 응답을 throw합니다.
 *
 * @param userId - 사용자 ID
 * @throws {Response} 429 Too Many Requests
 */
export function requirePasswordChangeRateLimit(userId: string): void {
  const { allowed, remainingAttempts, resetTime } =
    checkPasswordChangeRateLimit(userId);

  if (!allowed) {
    const minutesUntilReset = Math.ceil(
      (resetTime.getTime() - Date.now()) / 60000,
    );

    throw data(
      {
        error: `비밀번호 변경 시도 횟수를 초과했습니다. ${minutesUntilReset}분 후에 다시 시도해주세요.`,
        resetTime: resetTime.toISOString(),
        remainingAttempts: 0,
      },
      { status: 429 },
    );
  }

  // 시도 기록
  recordPasswordChangeAttempt(userId);

  console.log(
    `[Password Change Rate Limit] User ${userId}: ${remainingAttempts - 1} attempts remaining`,
  );
}

/**
 * Rate Limit 초기화 (성공 시 호출)
 *
 * 비밀번호 변경 성공 시 해당 사용자의 제한을 초기화합니다.
 *
 * @param userId - 사용자 ID
 */
export function resetPasswordChangeRateLimit(userId: string): void {
  rateLimitStore.delete(userId);
}
