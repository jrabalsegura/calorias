import nextEnv from "@next/env";
import { spawn } from "node:child_process";

const { loadEnvConfig } = nextEnv;
const args = process.argv.slice(2);
const development = args[0] === "--dev";
if (development) args.shift();
loadEnvConfig(process.cwd(), development);

const secret = process.env.AUTH_SECRET;
if (
  !secret ||
  secret.length < 32 ||
  [
    "replace-with-at-least-32-random-bytes",
    "change-me-before-publishing"
  ].includes(secret)
) {
  throw new Error(
    "Configura AUTH_SECRET con un secreto aleatorio de al menos 32 caracteres antes de arrancar."
  );
}

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", development ? "dev" : "start", ...args],
  { stdio: "inherit" }
);

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 0 : 1)));
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => child.kill(signal));
}
