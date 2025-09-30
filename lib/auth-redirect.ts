const DEFAULT_REDIRECT_PATH = "/homeowner";

const isRelativeUrl = (value: string) => {
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;

  try {
    const url = new URL(value, "http://localhost");
    return url.origin === "http://localhost";
  } catch {
    return false;
  }
};

export const sanitizeRedirectPath = (raw?: string | null) => {
  if (!raw) return undefined;

  const trimmed = raw.trim();

  if (!trimmed) return undefined;
  if (!isRelativeUrl(trimmed)) return undefined;

  return trimmed;
};

export const resolveRedirectPath = (raw?: string | null) => sanitizeRedirectPath(raw) ?? DEFAULT_REDIRECT_PATH;

export const getFirstSearchParamValue = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
