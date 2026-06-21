// Mem0 stores memories in a generic third-person voice it learned from
// the {role: 'user', role: 'assistant'} messages we feed it: "User likes
// X", "Assistant suggested Y". Without a name in the input, that's the
// best it can do. On the student-facing pages we substitute "User"
// with the student's own first name, and drop the meta-summaries about
// the assistant which aren't useful to the student.

export function humanizeMemory(
  summary: string | null | undefined,
  firstName: string | null | undefined,
): string {
  if (!summary) return "";
  const name = (firstName ?? "").trim();

  // Mem0 separates memories with " | ". Treat each one independently so a
  // bad line doesn't poison the rest.
  const parts = summary.split(" | ");
  const cleaned = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !isAssistantMeta(p));

  const withName = name ? cleaned.map((p) => substituteName(p, name)) : cleaned;
  return withName.join(" ");
}

// Drop Mem0 "facts" that are actually about the AI assistant rather
// than about the student — these read as noise to the student.
function isAssistantMeta(line: string): boolean {
  const l = line.toLowerCase();
  return (
    l.startsWith("assistant ") ||
    l.startsWith("the assistant ") ||
    l.includes("ai assistant") ||
    l.includes("has no specific prompt") ||
    l.includes("designed to have a conversation")
  );
}

function substituteName(line: string, name: string): string {
  // Capitalised "User" → first name; lowercase "user" → "you".
  // Possessive forms handled too.
  return line
    .replace(/\bUser's\b/g, `${name}'s`)
    .replace(/\bUser\b/g, name)
    .replace(/\buser's\b/g, "your")
    .replace(/\buser\b/g, "you");
}
