const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateSite } = require('../logic.js');
const base = { infectionType:'PNEU', criterion:'PNU2', doe:'2026-01-02', iwpStart:'2026-01-01', iwpEnd:'2026-01-03', ritStart:'2026-01-02', ritEnd:'2026-01-15', sbapStart:'2026-01-02', sbapEnd:'2026-01-16', siteSpecimenDate:'2026-01-02', siteOrganisms:'E. coli', organismUsed:'yes', bloodDate:'2026-01-05', bloodOrganisms:'E. coli', matching:'yes', bsiEligible:'yes', bloodUse:'no', bloodSatisfies:'no', manualVerified:'yes', documentation:'Lab report' };
const scenario1 = { scenario1Eligible:true, scenario2Eligible:true };
test('classifies a qualifying matching site organism as Scenario 1 secondary BSI', () => assert.equal(evaluateSite(base, scenario1).scenario, 'Scenario 1'));
test('does not treat a blood result outside SBAP as secondary', () => assert.equal(evaluateSite({...base, bloodDate:'2026-02-01'}, scenario1).status, 'neither'));
test('does not allow a non-BSI blood result to establish secondary BSI', () => assert.equal(evaluateSite({...base, bsiEligible:'no'}, scenario1).status, 'neither'));
test('classifies a qualifying blood-as-criterion case as Scenario 2 only when permitted', () => {
  const site = {...base, organismUsed:'no', matching:'no', bloodUse:'yes', bloodSatisfies:'yes'};
  assert.equal(evaluateSite(site, {scenario1Eligible:false, scenario2Eligible:true}).scenario, 'Scenario 2');
  assert.equal(evaluateSite(site, {scenario1Eligible:false, scenario2Eligible:false}).status, 'neither');
});
test('flags specialized definitions as indeterminate', () => assert.equal(evaluateSite(base, {specialReview:true, manualVerificationReason:'special rules'}).status, 'indeterminate'));
