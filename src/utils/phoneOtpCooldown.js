/** Persisted cooldown after Firebase `auth/too-many-requests` (SMS throttling). */

const PREFIX = "bbb_phone_otp_cooldown_";
const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * @param {string} e164 e.g. +919971433169
 * @returns {number} Unix ms when user can retry, or 0 if no active cooldown
 */
export function readPhoneOtpCooldownUntil(e164) {
  if (!e164) return 0;
  try {
    const raw = localStorage.getItem(PREFIX + e164);
    if (!raw) return 0;
    const { until } = JSON.parse(raw);
    if (typeof until !== "number" || until <= Date.now()) return 0;
    return until;
  } catch {
    return 0;
  }
}

/**
 * @param {string} e164
 * @param {number} untilMs
 */
export function writePhoneOtpCooldownUntil(e164, untilMs) {
  if (!e164) return;
  localStorage.setItem(PREFIX + e164, JSON.stringify({ until: untilMs }));
}

export function defaultPhoneOtpBackoffUntilMs() {
  return Date.now() + DEFAULT_COOLDOWN_MS;
}

export function formatRetryAfter(seconds) {
  if (seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
