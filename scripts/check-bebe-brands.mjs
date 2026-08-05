import fs from 'fs';

const brands = fs.readFileSync('c:/Users/j.pouchain/Downloads/brands_rows (2).sql', 'utf8');
const re = /\((\d+),\s*'((?:''|[^'])*)',\s*'([^']+)',\s*'([^']+)'\)/g;
const rows = [];
let m;
while ((m = re.exec(brands))) {
  rows.push({ id: +m[1], name: m[2].replace(/''/g, "'"), gender: m[3], type: m[4] });
}

const bebe = rows.filter((r) => r.gender === 'bebe');
const byType = {};
for (const r of bebe) {
  byType[r.type] = (byType[r.type] ?? 0) + 1;
}
console.log('Bebe brands by type:', byType);
console.log('Sample bebe vetements:', bebe.filter((r) => r.type === 'vetements').slice(0, 5).map((r) => r.name));
