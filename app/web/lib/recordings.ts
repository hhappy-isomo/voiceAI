import "server-only";
import { adminClient } from "@/lib/admin";

const BUCKET = "recordings";
// 5 minutes is plenty for the dashboard to render <audio src>. The
// browser stays on the page, the URL gets opened immediately. If the
// facilitator leaves the tab and returns later, the page will re-render
// with a fresh signed URL — they never see a permanent link.
const TTL_SECONDS = 60 * 5;

// Turn a storage path stored in sessions.recording_url into a short-lived
// signed URL. Returns null if the value isn't a path, the file's missing,
// or signing fails.
export async function signRecordingPath(
  pathOrUrl: string | null | undefined,
): Promise<string | null> {
  if (!pathOrUrl) return null;
  // Tolerate legacy rows that still hold a public URL from before this fix.
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const admin = adminClient();
  const { data } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(pathOrUrl, TTL_SECONDS);
  return data?.signedUrl ?? null;
}

// Sign a batch in parallel. Order is preserved.
export async function signRecordingPaths(
  paths: (string | null | undefined)[],
): Promise<(string | null)[]> {
  return Promise.all(paths.map(signRecordingPath));
}
