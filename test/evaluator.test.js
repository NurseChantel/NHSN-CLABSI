'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateCLABSI } = require('../src');

const base = { organismRelatedToAnotherSite: false };
test('accepts a recognized pathogen culture and uses its collection date as LCBI 1 DOE', () => {
  const r = evaluateCLABSI({ ...base, bloodSpecimens: [{ specimenNumber: '1', collectionDate: '2026-01-10', organism: 'Escherichia coli', method: 'culture' }] });
  assert.equal(r.selectedCriterion, 'LCBI 1');
  assert.equal(r.criteria[0].doe, '2026-01-10');
  assert.deepEqual(r.criteria[0].infectionWindowPeriod, { start: '2026-01-10', end: '2026-01-16' });
});
test('NCT is disregarded when a culture is collected in its override period', () => {
  const r = evaluateCLABSI({ ...base, bloodSpecimens: [
    { specimenNumber: 'n', collectionDate: '2026-01-10', organism: 'Candida albicans', method: 'pcr', eligibleNct: true },
    { specimenNumber: 'c', collectionDate: '2026-01-11', organism: 'Staphylococcus epidermidis', method: 'culture' }
  ] });
  assert.equal(r.criteria[0].status, 'not met');
  assert.match(r.criteria[0].unusedOrIneligibleSpecimens[0].reason, /NCT override applied/);
});
test('matches complementary common commensal identifications and permits central/peripheral draws', () => {
  const r = evaluateCLABSI({ ...base, symptoms: [{ type: 'fever', date: '2026-01-10', temperature: 38.5, unit: 'C', note: 'nursing' }], bloodSpecimens: [
    { specimenNumber: 'a', collectionDate: '2026-01-10', organism: 'Staphylococcus epidermidis', method: 'culture', source: 'central line' },
    { specimenNumber: 'b', collectionDate: '2026-01-11', organism: 'coagulase-negative Staphylococcus', method: 'culture', source: 'peripheral' }
  ] });
  assert.equal(r.selectedCriterion, 'LCBI 2');
  assert.equal(r.criteria[1].doe, '2026-01-10');
});
test('excludes catheter-tip cultures and uses earliest symptom or pair specimen for LCBI 3 DOE', () => {
  const r = evaluateCLABSI({ ...base, patientAgeYears: 0.5, symptoms: [{ type: 'apnea', date: '2026-01-10', note: 'monitor' }], bloodSpecimens: [
    { specimenNumber: 'tip', collectionDate: '2026-01-08', organism: 'Bacillus cereus', method: 'culture', specimenType: 'catheter tip' },
    { specimenNumber: 'a', collectionDate: '2026-01-10', organism: 'Bacillus species, not anthracis', method: 'culture' },
    { specimenNumber: 'b', collectionDate: '2026-01-11', organism: 'Bacillus cereus', method: 'culture' }
  ] });
  assert.equal(r.selectedCriterion, 'LCBI 3');
  assert.equal(r.criteria[2].doe, '2026-01-10');
  assert.match(r.criteria[2].unusedOrIneligibleSpecimens[0].reason, /catheter-tip/);
});
