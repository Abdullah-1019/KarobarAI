// Returns the aria-describedby token for a field: the error message wins over the hint, matching
// the single message FieldShell actually renders. Lives in its own module so FieldShell.tsx only
// exports components (react-refresh).
export function fieldDescribedBy(id: string | undefined, error?: string, hint?: string) {
  if (!id) return undefined;
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}
