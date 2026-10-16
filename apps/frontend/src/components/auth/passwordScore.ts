// Scores a password into 4 buckets so the meter has the four segments this design calls for:
//   length >= 8 | upper AND lower | a digit | a symbol
// Mirrors packages/shared's passwordSchema (>=8 chars incl. upper/lower/digit/special).
export function scorePassword(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}
