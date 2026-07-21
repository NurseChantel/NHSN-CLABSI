'use strict';

/** January 2026 NHSN laboratory-confirmed bloodstream infection evaluator. */
const DAY = 24 * 60 * 60 * 1000;
const COMMENSAL_GENERA = new Set([
  'staphylococcus', 'corynebacterium', 'bacillus', 'micrococcus', 'cutibacterium',
  'propionibacterium', 'enterococcus', 'viridans streptococcus', 'streptococcus viridans', 'aerococcus'
]);

function dateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function iso(d) { return d ? d.toISOString().slice(0, 10) : null; }
function daysBetween(a, b) { return Math.round((dateOnly(b) - dateOnly(a)) / DAY); }
function normalized(value) { return String(value || '').toLowerCase().replace(/[._,()]/g, ' ').replace(/\s+/g, ' ').trim(); }
function organismName(s) { return s.organism || s.organismName || s.name || ''; }
function isBlood(s) { return normalized(s.specimenType || s.type || 'blood') === 'blood'; }
function isCatheterTip(s) { return /catheter\s*tip|line\s*tip/.test(normalized(s.specimenType || s.source)); }
function isCulture(s) { return normalized(s.method || s.testMethod || 'culture') === 'culture'; }
function collectionDate(s) { return s.collectionDate || s.collectedAt || s.date; }
function directNct(s) { return !isCulture(s) && Boolean(s.eligibleNct !== false) && Boolean(s.directFromBlood !== false); }

function commonCommensal(s) {
  if (typeof s.commonCommensal === 'boolean') return s.commonCommensal;
  if (typeof s.isCommonCommensal === 'boolean') return s.isCommonCommensal;
  const name = normalized(organismName(s));
  return [...COMMENSAL_GENERA].some(g => name === g || name.startsWith(`${g} `)) || /coagulase[ -]negative staphylococcus/.test(name);
}
function organismKey(s) {
  const x = normalized(organismName(s));
  // A genus-only report complements a species report; never use morphology/antibiogram/biotype.
  if (/coagulase[ -]negative staphylococcus/.test(x) || /^staphylococcus($| species)/.test(x)) return 'staphylococcus';
  if (/^enterococcus($| species)/.test(x)) return 'enterococcus';
  if (/^bacillus($| species)/.test(x)) return 'bacillus';
  if (/viridans/.test(x) || /^streptococcus($| species)/.test(x)) return 'viridans streptococcus';
  return x.split(' ').slice(0, 2).join(' ');
}
function sameOrganism(a, b) {
  const an = normalized(organismName(a)), bn = normalized(organismName(b));
  if (!an || !bn) return false;
  const ak = organismKey(a), bk = organismKey(b);
  return ak === bk || an.startsWith(`${bk} `) || bn.startsWith(`${ak} `);
}
function separateOccasions(a, b) {
  const aId = a.specimenNumber || a.specimenId || a.drawId;
  const bId = b.specimenNumber || b.specimenId || b.drawId;
  const separatelyProcessed = a.processedSeparately !== false && b.processedSeparately !== false;
  const separatelyReported = a.reportedSeparately !== false && b.reportedSeparately !== false;
  return Boolean(aId && bId && aId !== bId && separatelyProcessed && separatelyReported && Math.abs(daysBetween(collectionDate(a), collectionDate(b))) <= 1);
}
function symptomTemperatureC(symptom) {
  const value = Number(symptom.temperature);
  if (!Number.isFinite(value)) return NaN;
  return normalized(symptom.unit || symptom.temperatureUnit) === 'f' ? (value - 32) * 5 / 9 : value;
}
function symptomPasses(symptom, pediatric) {
  const type = normalized(symptom.type || symptom.symptomType);
  const temperature = symptomTemperatureC(symptom);
  if (type === 'fever') return temperature > 38;
  if (pediatric && (type === 'hypothermia')) return temperature < 36;
  return pediatric ? ['apnea', 'bradycardia'].includes(type) : ['chills', 'hypotension'].includes(type);
}
function window(start) { const d = dateOnly(start); return { start: iso(d), end: iso(new Date(d.valueOf() + 6 * DAY)) }; }
function inWindow(value, w) { const d = dateOnly(value); return d && d >= dateOnly(w.start) && d <= dateOnly(w.end); }
function state(met, indeterminate) { return met ? 'met' : indeterminate ? 'indeterminate' : 'not met'; }
function resultBase(criterion, met, missing, payload, indeterminate = false) {
  return { criterion, status: state(met, indeterminate), met, missingElements: missing, ...payload };
}

function evaluateLCBI1(input, specimens, related) {
  const excluded = [], candidates = [];
  for (const s of specimens) {
    if (!isBlood(s) || isCatheterTip(s)) { excluded.push({ specimen: s, reason: 'Not a blood specimen: catheter-tip cultures are never eligible.' }); continue; }
    if (!collectionDate(s) || !organismName(s)) { excluded.push({ specimen: s, reason: 'Missing collection date or organism identification.' }); continue; }
    if (isCulture(s)) {
      if (commonCommensal(s)) excluded.push({ specimen: s, reason: 'Culture common commensal cannot establish LCBI 1.' });
      else candidates.push({ specimen: s, rule: 'Recognized pathogen identified by blood culture.' });
    } else if (directNct(s)) {
      const nctDate = collectionDate(s);
      const culture = specimens.find(c => isBlood(c) && !isCatheterTip(c) && isCulture(c) && collectionDate(c) && daysBetween(nctDate, collectionDate(c)) >= -2 && daysBetween(nctDate, collectionDate(c)) <= 1);
      if (culture) excluded.push({ specimen: s, reason: `NCT override applied: blood culture collected ${iso(dateOnly(collectionDate(culture)))} is within two calendar days before through one calendar day after this NCT; NCT disregarded.` });
      else if (commonCommensal(s)) excluded.push({ specimen: s, reason: 'NCT organism is a common commensal, not a recognized LCBI 1 pathogen.' });
      else candidates.push({ specimen: s, rule: 'NCT override applied: no blood culture was collected from two calendar days before through one calendar day after the NCT; eligible NCT evaluated.' });
    } else excluded.push({ specimen: s, reason: 'Non-culture test is not an eligible direct-from-blood NCT.' });
  }
  candidates.sort((a,b) => daysBetween(collectionDate(b.specimen), collectionDate(a.specimen))); 
  const used = candidates[0];
  const missing = [];
  if (related === undefined || related === null) missing.push('Whether the organism is related to an infection at another body site.');
  if (!used) missing.push('An eligible recognized bacterial or fungal pathogen from blood.');
  const met = Boolean(used) && related === false;
  return resultBase('LCBI 1', met, missing, { doe: met ? iso(dateOnly(collectionDate(used.specimen))) : null, infectionWindowPeriod: met ? window(collectionDate(used.specimen)) : null, bloodSpecimensUsed: used ? [used.specimen] : [], symptomsUsed: [], organismsUsed: used ? [organismName(used.specimen)] : [], unusedOrIneligibleSpecimens: excluded, appliedRule: used && used.rule }, related === undefined || related === null);
}

function evaluateCommensal(input, specimens, related, pediatric) {
  const criterion = pediatric ? 'LCBI 3' : 'LCBI 2';
  const excluded = [], eligible = [];
  for (const s of specimens) {
    if (!isBlood(s) || isCatheterTip(s)) { excluded.push({ specimen: s, reason: 'Not a blood specimen: catheter-tip cultures are never eligible.' }); continue; }
    if (!isCulture(s)) { excluded.push({ specimen: s, reason: 'Only culture results may establish the matching common-commensal element.' }); continue; }
    if (!commonCommensal(s)) { excluded.push({ specimen: s, reason: 'Not an NHSN common commensal.' }); continue; }
    if (!collectionDate(s) || !organismName(s)) { excluded.push({ specimen: s, reason: 'Missing collection date or organism identification.' }); continue; }
    eligible.push(s);
  }
  let pair = null;
  for (let i=0; i<eligible.length && !pair; i++) for (let j=i+1; j<eligible.length; j++) if (sameOrganism(eligible[i], eligible[j]) && separateOccasions(eligible[i], eligible[j])) { pair = [eligible[i], eligible[j]].sort((a,b) => daysBetween(collectionDate(b), collectionDate(a))); break; }
  const missing = [];
  if (pediatric && !(Number(input.patientAgeYears) <= 1)) missing.push('Patient age of 1 year or younger.');
  if (related === undefined || related === null) missing.push('Whether the organism is related to an infection at another body site.');
  if (!pair) missing.push('Two matching common-commensal blood cultures on separate occasions collected the same or consecutive calendar days.');
  let symptoms = [], iwp = null;
  if (pair) { iwp = window(collectionDate(pair[0])); symptoms = (input.symptoms || []).filter(x => symptomPasses(x, pediatric) && inWindow(x.date || x.occurredAt, iwp)); }
  if (!symptoms.length) missing.push(pediatric ? 'Fever >38°C, hypothermia <36°C, apnea, or bradycardia in the infection window.' : 'Fever >38°C, chills, or hypotension in the infection window.');
  const ageOK = !pediatric || Number(input.patientAgeYears) <= 1;
  const met = Boolean(pair) && Boolean(symptoms.length) && related === false && ageOK;
  const doeDates = pair ? [collectionDate(pair[0]), ...symptoms.map(s => s.date || s.occurredAt)].filter(Boolean).sort((a,b) => daysBetween(b,a)) : [];
  return resultBase(criterion, met, missing, { doe: met ? iso(dateOnly(doeDates[0])) : null, infectionWindowPeriod: met ? iwp : null, bloodSpecimensUsed: pair || [], symptomsUsed: symptoms, organismsUsed: pair ? [organismName(pair[0])] : [], unusedOrIneligibleSpecimens: excluded, appliedRule: 'Matching common commensals compared by genus/species only; collection source was not used.' }, related === undefined || related === null || (pediatric && input.patientAgeYears === undefined));
}

function evaluateCLABSI(input = {}) {
  const specimens = Array.isArray(input.bloodSpecimens) ? input.bloodSpecimens : [];
  const related = input.organismRelatedToAnotherSite ?? input.relatedToAnotherSite;
  const lcbi1 = evaluateLCBI1(input, specimens, related);
  const lcbi2 = evaluateCommensal(input, specimens, related, false);
  const lcbi3 = evaluateCommensal(input, specimens, related, true);
  const selected = lcbi1.met ? lcbi1 : (lcbi2.met ? lcbi2 : (lcbi3.met ? lcbi3 : null));
  const hierarchy = lcbi1.met && (lcbi2.met || lcbi3.met)
    ? 'LCBI 1 takes precedence over LCBI 2/3. The recognized pathogen is pathogen number 1 and the common commensal is pathogen number 2.' : null;
  return { selectedCriterion: selected ? selected.criterion : null, classification: selected ? selected.status : (lcbi1.status === 'indeterminate' || lcbi2.status === 'indeterminate' || lcbi3.status === 'indeterminate' ? 'indeterminate' : 'not met'), hierarchyExplanation: hierarchy, criteria: [lcbi1, lcbi2, lcbi3] };
}
module.exports = { evaluateCLABSI, evaluateLCBI: evaluateCLABSI, sameOrganism, separateOccasions, commonCommensal };
