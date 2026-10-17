// Test delle funzioni di base: codice fiscale, partita IVA, importi in lettere, CSV.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCF, validateCF, decodeCF, validatePIVA, placeCode } from '../src/renderer/js/lib/cf.js';
import { numberToWords, euroInWords } from '../src/renderer/js/lib/words.js';
import { parseCSV, toCSV, parseDateIT } from '../src/renderer/js/lib/csv.js';

test('codice fiscale: calcolo da dati anagrafici', () => {
  // esempio ufficiale dell'Agenzia delle Entrate
  const r = computeCF({ nome: 'Mario', cognome: 'Rossi', dataNascita: '1980-01-01', sesso: 'M', luogoNascita: 'Roma', provinciaNascita: 'RM' });
  assert.equal(r.value, 'RSSMRA80A01H501U');
  const f = computeCF({ nome: 'Aurora', cognome: 'Di Mauro', dataNascita: '2015-03-21', sesso: 'F', luogoNascita: 'Acireale', provinciaNascita: 'CT' });
  assert.ok(f.ok);
  assert.equal(f.value.slice(0, 15), 'DMRRRA15C61A028');
  assert.ok(validateCF(f.value).ok);
});

test('codice fiscale: nome con 4 o più consonanti e cognome corto', () => {
  const r = computeCF({ nome: 'Gianfranco', cognome: 'Fo', dataNascita: '1990-12-31', sesso: 'M', luogoNascita: 'Milano', provinciaNascita: 'MI' });
  assert.equal(r.value.slice(0, 6), 'FOXGFR');
  assert.equal(r.value.slice(6, 11), '90T31');
});

test('codice fiscale: nati all\'estero', () => {
  assert.equal(placeCode('Germania'), 'Z112');
  const r = computeCF({ nome: 'Anna', cognome: 'Muller', dataNascita: '2010-06-15', sesso: 'F', luogoNascita: 'Germania' });
  assert.equal(r.value.slice(11, 15), 'Z112');
});

test('codice fiscale: verifica e decodifica', () => {
  assert.equal(validateCF('RSSMRA80A01H501X').ok, false);
  assert.equal(validateCF('ABC').ok, false);
  const d = decodeCF('RSSMRA80A01H501U');
  assert.deepEqual(d, { dataNascita: '1980-01-01', sesso: 'M', luogoNascita: 'Roma', provinciaNascita: 'RM' });
});

test('partita IVA', () => {
  assert.equal(validatePIVA('01114601006').ok, true);
  assert.equal(validatePIVA('01114601007').ok, false);
  assert.equal(validatePIVA('123').ok, false);
});

test('importi in lettere', () => {
  assert.equal(numberToWords(0), 'zero');
  assert.equal(numberToWords(21), 'ventuno');
  assert.equal(numberToWords(28), 'ventotto');
  assert.equal(numberToWords(33), 'trentatré');
  assert.equal(numberToWords(108), 'centotto');
  assert.equal(numberToWords(180), 'centottanta');
  assert.equal(numberToWords(1000), 'mille');
  assert.equal(numberToWords(1250), 'milleduecentocinquanta');
  assert.equal(numberToWords(21000), 'ventunmila');
  assert.equal(numberToWords(1000000), 'unmilione');
  assert.equal(euroInWords(150), 'centocinquanta/00');
  assert.equal(euroInWords(77.5), 'settantasette/50');
});

test('CSV compatibile con Excel', () => {
  const rows = parseCSV('﻿Nome;Cognome;Note\r\nAurora;Di Mauro;"ciao; ""tutti"""\r\n');
  assert.deepEqual(rows, [['Nome', 'Cognome', 'Note'], ['Aurora', 'Di Mauro', 'ciao; "tutti"']]);
  assert.ok(toCSV([['a;b', 'c']]).includes('"a;b";c'));
  assert.equal(parseDateIT('21/03/2015'), '2015-03-21');
  assert.equal(parseDateIT('2015-3-1'), '2015-03-01');
});
