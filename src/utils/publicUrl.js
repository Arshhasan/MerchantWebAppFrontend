/**
 * URL for a file in /public when the app is served under Vite `base` (e.g. /merchant/).
 */
export function publicUrl(path) {
  const p = String(path).replace(/^\//, '');
  return `${import.meta.env.BASE_URL}${p}`;
}
