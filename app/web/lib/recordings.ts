import "server-only";
import { adminClient } from "@/lib/admin";

const BUCKET = "recordings";
// 30 minutes. Long enough that a facilitator can leave a tab open
// through a meeting and still hit play; short enough that a leaked
// URL goes stale before it's useful. If they re-render the page
// they get a fresh URL anyway.
const TTL_SECONDS = 60 * 30;

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
