/* global SecondaryBSI */
(async () => {
  const definitions = await fetch('site-definitions.v2026.1.json').then(r => r.json());
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const siteList = $('#site-list');
  const noSite = $('#no-site');
  $('#definition-version').textContent = `Eligibility data version ${definitions.version} (effective ${definitions.effectiveDate})`;

  function selectedDefinition(card) {
    const type = $('[data-field="infectionType"]', card).value;
    const criterion = $('[data-field="criterion"]', card).value;
    return definitions.definitions.find(d => d.infectionType === type && d.criterion === criterion);
  }
  function values(card) { return Object.fromEntries([...card.querySelectorAll('[data-field]')].map(x => [x.dataset.field, x.value])); }
  function updateCriteria(card) {
    const type = $('[data-field="infectionType"]', card).value;
    const select = $('[data-field="criterion"]', card);
    select.innerHTML = '<option value="">Select…</option>' + definitions.definitions.filter(d => d.infectionType === type).map(d => `<option>${d.criterion}</option>`).join('');
  }
  function render() {
    const cards = [...siteList.children];
    cards.forEach((card, i) => {
      $('.site-number', card).textContent = i + 1;
      const definition = selectedDefinition(card);
      $('.review-message', card).textContent = definition?.manualVerificationRequired ? `Manual verification required: ${definition.manualVerificationReason}` : '';
    });
    const evaluations = cards.map(c => ({ card: c, site: values(c), definition: selectedDefinition(c) })).map(x => ({ ...x, evaluation: SecondaryBSI.evaluateSite(x.site, x.definition) }));
    const resolved = noSite.checked || (evaluations.length > 0 && evaluations.every(x => x.evaluation.status !== 'indeterminate'));
    $('#finalize').disabled = !resolved;
    $('#block-reason').textContent = resolved ? 'Secondary BSI evaluation complete. Final CLABSI classification may now be given.' : 'Blocked: a potentially eligible primary site remains unresolved, or chart review attestation is required.';
    $('#block-reason').className = resolved ? 'ready' : 'blocked';
    const output = noSite.checked ? '<strong>No possible site-specific infection was identified after chart review.</strong> Secondary-site review is complete.' : evaluations.length ? evaluations.map(({site, definition, evaluation}) => `<article class="${evaluation.status}"><strong>${site.infectionType || 'Unspecified site'} — ${site.criterion || 'criterion pending'}:</strong> ${evaluation.scenario}<ul><li><b>Site DOE:</b> ${site.doe || 'Not documented'}; <b>SBAP:</b> ${site.sbapStart || '?'} to ${site.sbapEnd || '?'}</li><li><b>Blood collection:</b> ${site.bloodDate || 'Not documented'}; <b>matching organism:</b> ${evaluation.matching || 'None documented'}</li><li><b>Secondary BSI:</b> ${evaluation.status === 'secondary' ? 'Yes' : evaluation.status === 'indeterminate' ? 'Indeterminate' : 'No'}</li><li>${evaluation.reason}</li>${definition?.manualVerificationRequired ? `<li>Manual verification: ${definition.manualVerificationReason}</li>` : ''}<li>Nonmatching subsequent bloodstream organisms are not attributed by this SBAP; evaluate each as primary, secondary to another site, ineligible, or indeterminate.</li></ul></article>`).join('') : 'Add a possible site or make the chart-review attestation.';
    $('#result').innerHTML = output;
  }
  function addSite() {
    noSite.checked = false;
    const fragment = $('#site-template').content.cloneNode(true);
    const card = $('article', fragment);
    const type = $('.infection-type', card);
    type.innerHTML = '<option value="">Select…</option>' + [...new Set(definitions.definitions.map(d => d.infectionType))].map(x => `<option>${x}</option>`).join('');
    type.addEventListener('change', () => { updateCriteria(card); render(); });
    card.addEventListener('input', render); card.addEventListener('change', render);
    $('.remove', card).addEventListener('click', () => { card.remove(); render(); });
    siteList.append(card); render();
  }
  $('#add-site').addEventListener('click', addSite);
  noSite.addEventListener('change', () => {
    if (noSite.checked && siteList.children.length) {
      if (!confirm('This attestation replaces the entered site evaluations. Continue?')) noSite.checked = false;
      else siteList.replaceChildren();
    }
    render();
  });
  $('#finalize').addEventListener('click', () => alert('Secondary BSI evaluation is complete. Continue with the final CLABSI classification workflow.'));
  render();
})();
