/**
 * Seed script: membuat akun admin untuk E2E testing.
 * Admin: email=admin@blog.com, username=admin, password=Admin1234!
 *
 * Jalankan: npx tsx prisma/seed.ts
 */
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@blog.com';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME_SEED ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD_SEED ?? 'Admin1234!';

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`Admin account already exists (${ADMIN_EMAIL}). Skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await prisma.user.create({
    data: {
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
    },
  });
  console.log(`Admin account created: ${admin.email} (id: ${admin.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
