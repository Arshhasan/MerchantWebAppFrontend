/**
 * When a user signs in/up with an email or phone that already has a Firestore `users` doc,
 * we send them to the dashboard and set this so OnboardingGate does not immediately redirect
 * them back into the onboarding wizard.
 */
export const SKIP_FORCED_ONBOARDING_UID_KEY = "bbb_skipForcedOnboardingUid";

/**
 * @param {string | undefined} uid
 */
export function rememberDashboardWithoutForcedOnboarding(uid) {
  if (typeof sessionStorage === "undefined" || !uid) return;
  sessionStorage.setItem(SKIP_FORCED_ONBOARDING_UID_KEY, uid);
}

export function clearDashboardWithoutForcedOnboarding() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(SKIP_FORCED_ONBOARDING_UID_KEY);
}
