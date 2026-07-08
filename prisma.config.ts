import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    process.env[key] = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());
  }
}

function loadLocalEnvFiles() {
  const rootDir = dirname(fileURLToPath(import.meta.url));
  for (const filePath of [".env.local", ".env"].map((file) => resolve(rootDir, file))) {
    loadEnvFile(filePath);
  }
}

loadLocalEnvFiles();

const fallbackDatabaseUrl = "postgresql://radar:radar@localhost:5432/radar";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    // `prisma generate` only needs a syntactically valid URL, not a live database.
    // Falling back here keeps clean CI/Vercel builds from failing before runtime envs are injected.
    url: process.env.DATABASE_URL ?? fallbackDatabaseUrl,
  },
});
