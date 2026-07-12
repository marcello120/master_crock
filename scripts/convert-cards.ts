import * as fs from 'fs';
import * as path from 'path';

interface CardDefinition {
  id: string;
  serial: string;
  name: string;
  tribe: string;
  strength: number;
  intelligence: number;
  reflex: number;
  abilityName: string;
  abilityText: string;
  imagePath: string;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

const csvPath = path.resolve(__dirname, '../cards.csv');
const outputPath = path.resolve(__dirname, '../src/data/cards.json');

const csv = fs.readFileSync(csvPath, 'utf-8');
const lines = csv.split('\n').filter(l => l.trim());
const headers = parseCSVLine(lines[0]);

console.log('Headers:', headers);

const cards: CardDefinition[] = [];

for (let i = 1; i < lines.length; i++) {
  const fields = parseCSVLine(lines[i]);
  if (fields.length < 9) {
    console.warn(`Skipping line ${i + 1}: not enough fields (${fields.length})`);
    continue;
  }

  const card: CardDefinition = {
    imagePath: fields[0],
    id: fields[0].replace(/\.jpg$/i, ''),
    name: fields[1],
    abilityName: fields[2],
    abilityText: fields[3],
    strength: parseInt(fields[4], 10),
    intelligence: parseInt(fields[5], 10),
    reflex: parseInt(fields[6], 10),
    serial: fields[7],
    tribe: fields[8],
  };

  if (isNaN(card.strength) || isNaN(card.intelligence) || isNaN(card.reflex)) {
    console.warn(`Skipping line ${i + 1}: invalid stats for "${card.name}"`);
    continue;
  }

  cards.push(card);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(cards, null, 2));
console.log(`Converted ${cards.length} cards to ${outputPath}`);
