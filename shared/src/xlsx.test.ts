import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, inflateRawSync } from 'node:zlib';
import { xlsxWorkbook } from './xlsx.js';

/** Fichiers d'une archive zip, lus d'après son répertoire central ; la somme de contrôle de chacun est vérifiée. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const buffer = Buffer.from(bytes);
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, 'fin de répertoire central absente');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const files = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    assert.equal(buffer.readUInt32LE(local), 0x04034b50);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const stored = buffer.subarray(start, start + size);
    const content = method === 8 ? inflateRawSync(stored) : stored;
    assert.equal(crc32(content), crc, `somme de contrôle de ${name}`);
    files.set(name, content.toString('utf8'));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

/** Valeurs des cellules de la feuille, ligne par ligne. */
function cells(sheet: string): string[][] {
  const unescape = (s: string) =>
    s.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&');
  return [...sheet.matchAll(/<row\b[^>]*>(.*?)<\/row>/gs)].map(([, row]) =>
    [...row!.matchAll(/<t\b[^>]*>(.*?)<\/t>/gs)].map(([, text]) => unescape(text!)),
  );
}

test('le classeur contient les parties d’un fichier Excel et une feuille au nom donné', () => {
  const files = unzip(xlsxWorkbook('Exigences', [['A']]));
  for (const part of [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/worksheets/sheet1.xml',
  ]) {
    assert.ok(files.has(part), part);
  }
  assert.match(files.get('xl/workbook.xml')!, /<sheet name="Exigences" sheetId="1" r:id="rId1"\/>/);
});

test('les cellules gardent accents, retours à la ligne et caractères spéciaux', () => {
  const rows = [
    ['Référence', 'Énoncé'],
    ['CRM-EX-012', 'Ligne 1\nLigne 2 < 3 & "citée" > 2'],
    ['', '  espaces gardés  '],
  ];
  const sheet = unzip(xlsxWorkbook('Exigences', rows)).get('xl/worksheets/sheet1.xml')!;
  assert.deepEqual(cells(sheet), rows);
  assert.match(sheet, /<c r="B2"/);
});

test('un caractère interdit en XML est retiré plutôt que de rendre le fichier illisible', () => {
  const sheet = unzip(xlsxWorkbook('Exigences', [['a\u0001b\u000bc']])).get('xl/worksheets/sheet1.xml')!;
  assert.deepEqual(cells(sheet), [['abc']]);
});

test('au-delà de la colonne Z, les colonnes s’appellent AA, AB…', () => {
  const row = Array.from({ length: 28 }, (_, i) => String(i));
  const sheet = unzip(xlsxWorkbook('Exigences', [row])).get('xl/worksheets/sheet1.xml')!;
  assert.match(sheet, /<c r="Z1"/);
  assert.match(sheet, /<c r="AB1"/);
});

test('les largeurs de colonnes données sont appliquées', () => {
  const sheet = unzip(xlsxWorkbook('Exigences', [['A', 'B']], { columnWidths: [14, 60] })).get('xl/worksheets/sheet1.xml')!;
  assert.match(sheet, /<col min="1" max="1" width="14" customWidth="1"\/><col min="2" max="2" width="60" customWidth="1"\/>/);
});
