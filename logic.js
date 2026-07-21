(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined') module.exports = api;
  root.SecondaryBSI = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const inside = (date, start, end) => Boolean(date && start && end && date >= start && date <= end);
  const complete = (s) => ['infectionType','criterion','doe','iwpStart','iwpEnd','ritStart','ritEnd','sbapStart','sbapEnd','siteSpecimenDate','siteOrganisms','organismUsed','bloodDate','bloodOrganisms','matching','bsiEligible','bloodUse','bloodSatisfies','manualVerified','documentation'].every(k => s[k]);
  // Kept separate for testability; evaluateSite below uses these exact safeguards.
  function evaluateSite(s, definition) {
    if (!complete(s)) return { status: 'indeterminate', scenario: 'Indeterminate', reason: 'Complete all required dates, blood findings, and criterion fields before this site can be resolved.' };
    if (definition?.specialReview) return { status: 'indeterminate', scenario: 'Indeterminate', reason: definition.manualVerificationReason };
    if (definition?.manualVerificationRequired && s.manualVerified !== 'yes') return { status: 'indeterminate', scenario: 'Indeterminate', reason: `Manual verification is required before resolution: ${definition.manualVerificationReason}` };
    if (s.bsiEligible !== 'yes') return { status: 'neither', scenario: 'Neither', reason: 'The blood result does not independently meet BSI criteria; for example, a single common commensal specimen cannot establish secondary BSI.' };
    if (!inside(s.bloodDate, s.sbapStart, s.sbapEnd)) return { status: 'neither', scenario: 'Neither', reason: 'The blood specimen was not collected during this site’s SBAP.' };
    if (definition?.scenario1Eligible && s.organismUsed === 'yes' && s.matching === 'yes') return { status: 'secondary', scenario: 'Scenario 1', matching: s.siteOrganisms, reason: 'An eligible site specimen organism was used for the site criterion and at least one eligible blood organism matches it during the SBAP.' };
    if (definition?.scenario2Eligible && s.bloodUse === 'yes' && s.bloodSatisfies === 'yes') return { status: 'secondary', scenario: 'Scenario 2', matching: s.bloodOrganisms, reason: 'The eligible site criterion permits blood specimen use, and this qualifying blood specimen satisfies that criterion during the SBAP.' };
    return { status: 'neither', scenario: 'Neither', reason: 'Neither eligible Scenario 1 nor eligible Scenario 2 was satisfied for this definition.' };
  }
  return { inside, complete, evaluateSite };
});
