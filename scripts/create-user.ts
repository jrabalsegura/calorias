// Creates the single user, or resets its password (which also closes every
// open session). Usage: npm run user:create [-- <username>]
// In production: sudo podman exec -it calorias node --import tsx scripts/create-user.ts
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const MIN_PASSWORD_LENGTH = 12;

async function main() {
  const prisma = new PrismaClient();
  try {
    const username = (process.argv[2] ?? (await ask("Usuario: ")))
      .trim()
      .toLowerCase();
    if (username.length < 3) {
      throw new Error("El usuario debe tener al menos 3 caracteres.");
    }

    const others = await prisma.appUser.count({
      where: { username: { not: username } }
    });
    if (others > 0) {
      throw new Error(
        "Ya existe otro usuario: la app es de usuario único. Usa ese nombre para cambiar la contraseña."
      );
    }

    const password = await ask("Contraseña: ", { hidden: true });
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      );
    }
    if (process.stdin.isTTY) {
      const repeated = await ask("Repite la contraseña: ", { hidden: true });
      if (repeated !== password) throw new Error("Las contraseñas no coinciden.");
    }

    const passwordHash = await hashPassword(password);
    const existing = await prisma.appUser.findUnique({ where: { username } });
    if (existing) {
      await prisma.appUser.update({
        where: { username },
        data: { passwordHash, sessionVersion: { increment: 1 } }
      });
      console.log(`Contraseña de "${username}" cambiada; se han cerrado sus sesiones.`);
    } else {
      await prisma.appUser.create({ data: { passwordHash, username } });
      console.log(`Usuario "${username}" creado.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Reads one line. Without a TTY (piped stdin) it just reads the next line.
let pipedLines: AsyncIterableIterator<string> | undefined;

async function ask(
  prompt: string,
  { hidden = false }: { hidden?: boolean } = {}
): Promise<string> {
  if (!process.stdin.isTTY) {
    pipedLines ??= createInterface({ input: process.stdin })[
      Symbol.asyncIterator
    ]();
    const { value } = await pipedLines.next();
    return value ?? "";
  }

  if (!hidden) {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    try {
      return await readline.question(prompt);
    } finally {
      readline.close();
    }
  }

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          finish();
          reject(new Error("Cancelado."));
          return;
        }
        if (char === "\u007f") value = value.slice(0, -1);
        else value += char;
      }
    };
    const finish = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    process.stdin.on("data", onData);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
