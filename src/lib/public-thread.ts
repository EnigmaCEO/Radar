export interface PublicThreadPost {
  text: string;
}

export interface PublicThreadDelivery {
  source: "approved" | "deterministic";
  previewHash: string;
  approvedPreviewHash?: string;
  posts: PublicThreadPost[];
}

function isPost(value: unknown): value is PublicThreadPost {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { text?: unknown }).text === "string" &&
    (value as { text: string }).text.trim().length > 0
  );
}

export async function getLatestPublicThreadDelivery(): Promise<PublicThreadDelivery | null> {
  const raw = process.env.RADAR_APPROVED_PUBLIC_THREAD_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      source?: unknown;
      previewHash?: unknown;
      approvedPreviewHash?: unknown;
      posts?: unknown;
    };

    const source =
      parsed.source === "approved" || parsed.source === "deterministic"
        ? parsed.source
        : null;
    const previewHash =
      typeof parsed.previewHash === "string" && parsed.previewHash.trim().length > 0
        ? parsed.previewHash
        : null;
    const approvedPreviewHash =
      typeof parsed.approvedPreviewHash === "string" && parsed.approvedPreviewHash.trim().length > 0
        ? parsed.approvedPreviewHash
        : undefined;
    const posts = Array.isArray(parsed.posts) ? parsed.posts.filter(isPost) : [];

    if (!source || !previewHash || posts.length === 0) return null;

    return {
      source,
      previewHash,
      approvedPreviewHash,
      posts,
    };
  } catch {
    return null;
  }
}
