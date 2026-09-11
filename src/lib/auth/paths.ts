export const SIGN_IN_PATH = "/sign-in";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_CODE_ERROR_PATH = "/auth/auth-code-error";
export const AUTH_SIGN_OUT_PATH = "/auth/sign-out";

const PUBLIC_PATHS = [
  SIGN_IN_PATH,
  AUTH_CALLBACK_PATH,
  AUTH_CODE_ERROR_PATH,
  AUTH_SIGN_OUT_PATH,
] as const;

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function safeNextPath(value: string | null | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}
