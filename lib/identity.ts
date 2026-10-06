export type SiteUser = {
  userId: string;
  displayName: string;
  email: string;
};

function decodeDisplayName(request: Request) {
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  if (!encoded || encoding !== "percent-encoded-utf-8") return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

export function getSiteUser(request: Request): SiteUser | null {
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  const email = request.headers.get("oai-authenticated-user-email")?.trim();
  if (userId && email) {
    return {
      userId,
      email,
      displayName: decodeDisplayName(request) || email.split("@")[0] || "同学",
    };
  }

  return null;
}
