// Δημιουργεί το shared/data/words.json από το words.source.json:
// προσθέτει σταθερά ids και υπολογισμένη δυσκολία σε κάθε λέξη.
// Εκτέλεση: npm run dict:build
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const out = execFileSync('npx', ['tsx', '-e', `
  import fs from 'node:fs';
  import { computeDifficulty, easeScore } from './shared/src/difficulty.ts';
  import { normalizeWord } from './shared/src/normalize.ts';
  const src = JSON.parse(fs.readFileSync('shared/data/words.source.json', 'utf8'));
  const categories = [], words = [];
  for (const c of src.categories) {
    categories.push({ id: c.id, name: c.name, icon: c.icon });
    c.words.forEach((w, i) => {
      normalizeWord(w);
      words.push({ id: c.id + '-' + String(i + 1).padStart(2, '0'), word: w, category: c.id, difficulty: computeDifficulty(w), ease: easeScore(w) });
    });
  }
  process.stdout.write(JSON.stringify({ version: 1, categories, words }));
`], { encoding: 'utf8' });

const data = JSON.parse(out);
const lines = ['{', `  "version": 1,`, `  "categories": [`];
lines.push(data.categories.map((c) => '    ' + JSON.stringify(c)).join(',\n'));
lines.push('  ],', '  "words": [');
lines.push(data.words.map((w) => '    ' + JSON.stringify(w)).join(',\n'));
lines.push('  ]', '}');
fs.writeFileSync('shared/data/words.json', lines.join('\n') + '\n');
const counts = data.words.reduce((m, w) => ((m[w.difficulty] = (m[w.difficulty] ?? 0) + 1), m), {});
console.log(`Λέξεις: ${data.words.length}, κατηγορίες: ${data.categories.length}`, counts);
