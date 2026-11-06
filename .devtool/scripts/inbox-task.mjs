#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INBOX_DIR = join(__dirname, "..", "features", "inbox");

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : null;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u00e0-\u00fc]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function nowISO() {
  return new Date().toISOString();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function parseLabels() {
  const idx = process.argv.indexOf("--labels");
  if (idx === -1) {
    console.error("ERROR: --labels é obrigatório. Ex: --labels '[\"perf\"]'");
    process.exit(2);
  }
  try {
    const val = JSON.parse(process.argv[idx + 1] ?? "[]");
    if (!Array.isArray(val) || val.length === 0) throw new Error();
    return val;
  } catch {
    console.error("ERROR: --labels deve ser um JSON array não vazio. Ex: --labels '[\"perf\"]'");
    process.exit(2);
  }
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      console.error("Usage: echo '# My task\n\nbody' | node inbox-task.mjs [--labels '[\"tag\"]']");
      process.exit(2);
    }
    const lines = [];
    const rl = createInterface({ input: process.stdin });
    rl.on("line", (line) => lines.push(line));
    rl.on("close", () => resolve(lines.join("\n")));
  });
}

async function main() {
  const labels = parseLabels();
  const content = await readStdin();

  if (!content || !content.trim()) {
    console.error("ERROR: stdin vazio");
    process.exit(2);
  }

  const title = extractTitle(content);
  if (!title) {
    console.error("ERROR: conteúdo precisa ter um heading # (ex: # Minha task)");
    process.exit(2);
  }

  const slug = slugify(title);
  const name = `${slug}-${todayStr()}`;
  const outPath = join(INBOX_DIR, `${name}.md`);

  if (existsSync(outPath)) {
    console.error(`ERRO: arquivo já existe: ${outPath}`);
    process.exit(2);
  }

  const existingMd = readdirSync(INBOX_DIR).filter((f) => f.endsWith(".md"));
  const order = `a${existingMd.length}`;
  const now = nowISO();

  const frontmatter = `---
id:
name: "${name}"
status: "inbox"
priority: "medium"
assignee: null
dueDate: null
created: "${now}"
modified: "${now}"
completedAt: null
labels: ${JSON.stringify(labels)}
order: "${order}"
---

${content.trim()}
`;

  writeFileSync(outPath, frontmatter, "utf-8");
  console.log(outPath);
}

main();
