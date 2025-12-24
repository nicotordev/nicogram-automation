import fs from "node:fs";
import path from "node:path";

const src = path.resolve("src/lib/generated/prisma");
const dst = path.resolve("dist/lib/generated/prisma");

if (!fs.existsSync(src)) {
  console.error(`❌ Prisma generated folder not found: ${src}`);
  console.error("   Run: bunx prisma generate");
  process.exit(1);
}

fs.mkdirSync(dst, { recursive: true });
fs.cpSync(src, dst, { recursive: true });

console.log("✅ Copied Prisma generated client to dist");
