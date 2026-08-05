import fs from 'fs';

const existingPath = 'c:/Users/j.pouchain/Downloads/brands_rows (2).sql';
const existing = fs.readFileSync(existingPath, 'utf8');

const tupleRe = /\((\d+),\s*'((?:''|[^'])*)',\s*'([^']+)',\s*'([^']+)'\)/g;

function parseRows(sql) {
  const rows = [];
  let m;
  while ((m = tupleRe.exec(sql))) {
    rows.push({
      id: Number(m[1]),
      name: m[2].replace(/''/g, "'"),
      gender: m[3],
      type: m[4],
    });
  }
  return rows;
}

const existingRows = parseRows(existing);
const key = (r) => `${r.name}|${r.gender}|${r.type}`;
const existingByKey = new Map(existingRows.map((r) => [key(r), r.id]));

console.log('Existing rows:', existingRows.length);
console.log('Max existing id:', Math.max(...existingRows.map((r) => r.id)));

// User pasted new rows in message - read from stdin arg file if provided
const newSqlPath = process.argv[2];
if (!newSqlPath) {
  console.log('Pass new SQL file path as argv[2] to compare');
  process.exit(0);
}

const newSql = fs.readFileSync(newSqlPath, 'utf8');
const newRows = parseRows(newSql);
console.log('New rows:', newRows.length);
console.log('New id range:', Math.min(...newRows.map((r) => r.id)), '-', Math.max(...newRows.map((r) => r.id)));

const dupKeys = [];
for (const r of newRows) {
  const k = key(r);
  if (existingByKey.has(k)) {
    dupKeys.push({ key: k, existingId: existingByKey.get(k), newId: r.id });
  }
}
console.log('Duplicate (name,gender,type) with existing:', dupKeys.length);
for (const d of dupKeys.slice(0, 30)) console.log(' ', d);

const dupIds = newRows.filter((r) => existingByKey.has(key(r)) === false && existingRows.some((e) => e.id === r.id));
console.log('New rows with id collision:', dupIds.length);

const newTypes = [...new Set(newRows.map((r) => r.type))].sort();
console.log('New types:', newTypes.join(', '));

const puericulture = newRows.filter((r) => r.type === 'puericulture');
console.log('Puericulture brands gender breakdown:', Object.fromEntries(
  [...new Set(puericulture.map((r) => r.gender))].map((g) => [g, puericulture.filter((r) => r.gender === g).length])
));
