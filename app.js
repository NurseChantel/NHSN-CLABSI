const $ = id => document.getElementById(id);
const value = id => $(id).value;
const yes = id => value(id) === 'yes';
const checked = id => $(id).checked;
const deviceExclusion = (days, current, label) => Number(value(days)) > 2 && checked(current) ? label : null;

function assess() {
  const criterion = value('criterion'), timing = value('timing'), secondary = value('secondary');
  const missing = [], warnings = [], failed = [], audit = [];
  if (criterion === 'unknown') missing.push('LCBI or MBI-LCBI criterion');
  if (!value('doe')) missing.push('date of event (DOE)');
  if (!value('iwp')) missing.push('BSI infection window period (IWP)');
  if (!value('rit')) missing.push('BSI repeat infection timeframe (RIT)');
  if (timing === 'unknown') warnings.push('Chapter 2 timing information has not been provided; POA/HAI status cannot be determined.');
  if (secondary === 'unknown') warnings.push('A site-specific NHSN definition is required to determine whether this is a secondary BSI.');
  const hasFoundation = ['lcbi','mbi'].includes(criterion);
  const primary = secondary === 'no';
  const lineKnown = value('eligibleLine') !== 'unknown';
  if (hasFoundation && !lineKnown) missing.push('eligible central-line presence on DOE or preceding day');

  let finalState, exclusion = 'None';
  audit.push('1. Data validation: ' + (missing.length ? `missing ${missing.join(', ')}.` : 'required assessment fields supplied.'));
  audit.push('2. Eligible blood organisms: ' + (value('bloodOrganisms') ? `recorded as ${value('bloodOrganisms')}.` : 'not provided.'));
  audit.push('3. LCBI evaluation: ' + ({unknown:'not evaluated',none:'no criteria met',lcbi:'LCBI established',mbi:'MBI-LCBI established'}[criterion]) + '.');
  audit.push('4. DOE and IWP: ' + (value('doe') && value('iwp') ? 'recorded.' : 'incomplete.'));
  audit.push('5. POA/HAI: ' + (timing === 'unknown' ? 'needs Chapter 2 information.' : timing.toUpperCase() + '.'));
  audit.push('6. Secondary BSI: ' + (secondary === 'unknown' ? 'needs site-specific definition.' : secondary === 'yes' ? 'secondary.' : 'primary.'));
  audit.push('7. MBI-LCBI: ' + (criterion === 'mbi' ? 'established.' : 'not established / not applicable.') );
  audit.push('8. Eligible central line: ' + (lineKnown ? (yes('eligibleLine') ? 'present on DOE or preceding day.' : 'not present.') : 'not determined.'));

  const neonatal = value('ageDays') !== '' && Number(value('ageDays')) <= 6 && /group b streptococcus|streptococcus agalactiae/i.test(value('bloodOrganisms'));
  const exclusions = [
    deviceExclusion('ecmoDays','ecmoCurrent','ECMO/ECLS'), deviceExclusion('vadDays','vadCurrent','ventricular assist device'), deviceExclusion('tahDays','tahCurrent','total artificial heart'),
    checked('injection') ? 'documented injection into vascular access line' : null,
    checked('eb') ? 'genetic epidermolysis bullosa in pediatric patient' : null,
    checked('factitious') ? 'Munchausen syndrome by proxy/factitious disorder imposed on another' : null,
    value('pusSite') && checked('pusSpecimen') && checked('pusMatch') ? `pus at ${value('pusSite')} with matching organism` : null
  ].filter(Boolean);
  if (neonatal) exclusions.push('Group B Streptococcus neonatal rule (DOE in first six days of life)');
  if (checked('injection')) audit.push('9. Injection exclusion: explicit injection concept confirmed by user; qualifying.');
  else audit.push('9. Injection exclusion: not confirmed (vague tampering is not accepted).');
  audit.push('9. CLABSI exclusions: ' + (exclusions.length ? exclusions.join('; ') + '.' : 'none qualifying.'));

  if (criterion === 'none') finalState = 'No LCBI criteria met';
  else if (missing.length) finalState = 'Indeterminate – missing information';
  else if (timing === 'poa') finalState = 'LCBI, present on admission';
  else if (secondary === 'yes') finalState = 'Secondary BSI';
  else if (secondary === 'unknown') finalState = 'Manual review required';
  else if (!yes('eligibleLine')) finalState = criterion === 'mbi' ? 'MBI-LCBI, not central-line associated' : 'Primary LCBI, not central-line associated';
  else if (exclusions.length) { finalState = criterion === 'mbi' ? 'Reportable MBI-LCBI with CLABSI exclusion' : 'Reportable LCBI with CLABSI exclusion'; exclusion = exclusions.join('; '); }
  else finalState = criterion === 'mbi' ? 'CLABSI – MBI-LCBI' : 'CLABSI – LCBI';

  if (!hasFoundation && criterion !== 'none') failed.push('An established LCBI or MBI-LCBI is required before CLABSI association can be assessed.');
  if (hasFoundation && !primary && secondary !== 'unknown') failed.push('CLABSI exclusions apply only to primary BSIs.');
  if (hasFoundation && !yes('eligibleLine')) failed.push('No eligible central line was documented on the DOE or preceding day.');
  const sir = /^CLABSI/.test(finalState) ? 'Yes' : 'No';
  const report = /^Reportable/.test(finalState) || /^CLABSI/.test(finalState) || finalState === 'LCBI, present on admission' ? 'Report as NHSN LCBI/MBI-LCBI as applicable' : finalState === 'Manual review required' || finalState.startsWith('Indeterminate') ? 'Do not finalize; obtain required information' : 'Not reportable as a CLABSI';
  audit.push('10. Final classification: ' + finalState + '.');
  render({finalState, criterion, exclusion, missing, warnings, failed, audit, sir, report, timing});
}

function render(r) {
  const criterion = r.criterion === 'mbi' ? 'MBI-LCBI' : r.criterion === 'lcbi' ? 'LCBI' : 'Not established';
  $('definitionWarning').hidden = !r.warnings.length;
  $('definitionWarning').textContent = r.warnings.join(' ');
  const item = (name, val) => `<dt>${name}</dt><dd>${val || 'Not provided'}</dd>`;
  $('result').innerHTML = `<h2>Final result</h2><h3><span class="tag ${r.finalState.includes('Indeterminate') || r.finalState.includes('Manual') ? 'bad' : ''}">${r.finalState}</span></h3><dl>
  ${item('LCBI or MBI criterion',criterion)}${item('DOE',value('doe'))}${item('BSI IWP',value('iwp'))}${item('BSI RIT',value('rit'))}${item('POA or HAI status',r.timing === 'unknown' ? 'Insufficient Chapter 2 data' : r.timing.toUpperCase())}${item('Secondary BSI result',value('secondary') === 'unknown' ? 'Manual review required' : value('secondary') === 'yes' ? 'Secondary BSI' : 'Primary BSI')}${item('Central-line eligibility result',value('eligibleLine') === 'unknown' ? 'Not determined' : yes('eligibleLine') ? 'Eligible line present' : 'No eligible line')}${item('Central-line day on DOE',value('lineDay'))}${item('Eligible line on DOE or previous day',value('eligibleLine') === 'unknown' ? 'Not provided' : yes('eligibleLine') ? 'Yes' : 'No')}${item('Exclusion applied',r.exclusion)}${item('NHSN reporting recommendation',r.report)}${item('Contributes to CLABSI SIR',r.sir)}${item('Supporting evidence',value('evidence'))}</dl>
  <h3>Failed elements</h3><p>${r.failed.join('<br>') || 'None identified.'}</p><h3>Missing information</h3><p>${r.missing.join('<br>') || 'None identified.'}</p><h3>Manual review warnings</h3><p>${r.warnings.join('<br>') || 'None.'}</p><h3>Rule-by-rule audit trail</h3><ol class="audit">${r.audit.map(x=>`<li>${x}</li>`).join('')}</ol>`;
}
$('assessment').addEventListener('submit', e => { e.preventDefault(); assess(); });
