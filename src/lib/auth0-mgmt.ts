// Auth0 Management API client — server-side only
// Used for reading/writing user_metadata (e.g. MFA toggle)

let cachedToken: { value: string; exp: number } | null = null;

async function getManagementToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const domain = process.env.AUTH0_DOMAIN!;
  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.AUTH0_MGMT_CLIENT_ID!,
      client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET!,
      audience: `https://${domain}/api/v2/`,
    }),
  });

  if (!res.ok) throw new Error(`Management token fetch failed: ${res.status}`);
  const { access_token, expires_in } = await res.json();
  cachedToken = { value: access_token, exp: Date.now() + expires_in * 1000 };
  return access_token;
}

export async function mgmtFetch(path: string, init?: RequestInit) {
  const token = await getManagementToken();
  const domain = process.env.AUTH0_DOMAIN!;
  return fetch(`https://${domain}/api/v2${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}
