import { AuthError } from '../errors/AppError';
import { prisma } from '../prisma';

// Every authenticated route carries the caller's publicId (req.user.sub) — Prisma relations are
// keyed on the internal bigint userId. Feature 6 is the first point where three new modules
// (cart, address, order) all need this exact one-line resolution, so it's extracted here rather
// than repeated three times (same threshold that justified extracting imageValidation in Feature 4).
export async function resolveUserId(publicId: string): Promise<bigint> {
  const user = await prisma.user.findUnique({ where: { publicId }, select: { userId: true } });
  if (!user) throw new AuthError();
  return user.userId;
}
