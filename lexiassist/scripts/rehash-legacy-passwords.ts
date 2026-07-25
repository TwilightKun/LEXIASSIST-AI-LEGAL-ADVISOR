import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const BCRYPT_SHAPE = /^\$2[aby]\$\d{2}\$.{53}$/;

async function main() {
  const users = await prisma.user.findMany({
    where: { password: { not: null } },
    select: { id: true, email: true, password: true },
  });

  let migrated = 0;

  for (const user of users) {
    if (!user.password || BCRYPT_SHAPE.test(user.password)) continue;

    const hashed = await bcrypt.hash(user.password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    migrated++;
    console.log(`Rehashed password for ${user.email}`);
  }

  console.log(`\nDone. ${migrated}/${users.length} accounts migrated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());