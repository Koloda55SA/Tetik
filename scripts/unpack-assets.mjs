#!/usr/bin/env node
/**
 * Распаковка бинарных ассетов из assets-b64/ в реальные пути.
 * Картинки хранятся в git как base64-текст (assets-b64/public/.../file.jpg.b64),
 * этот скрипт восстанавливает их в public/... Запускается автоматически на postinstall.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'assets-b64')

if (!fs.existsSync(SRC)) {
  console.log('assets-b64/ нет — пропускаю')
  process.exit(0)
}

let count = 0
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p)
    else if (entry.name.endsWith('.b64')) {
      const rel = path.relative(SRC, p).slice(0, -4) // убрать .b64
      const out = path.join(ROOT, rel)
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, Buffer.from(fs.readFileSync(p, 'utf8'), 'base64'))
      count++
    }
  }
}
walk(SRC)
console.log(`✓ Распаковано ассетов: ${count}`)
