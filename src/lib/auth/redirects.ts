export function getSafeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/app",
) {
  if (!candidate?.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return candidate;
}
