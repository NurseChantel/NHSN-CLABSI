# NHSN CLABSI Rule Engine

A dependency-free JavaScript evaluator for the **January 2026** NHSN LCBI 1, 2, and 3 criteria.

```js
const { evaluateCLABSI } = require('nhsn-clabsi-rule-engine');
const result = evaluateCLABSI({
  patientAgeYears: 45,
  organismRelatedToAnotherSite: false,
  bloodSpecimens: [{
    specimenNumber: 'B-01', collectionDate: '2026-01-10',
    organism: 'Escherichia coli', method: 'culture'
  }],
  symptoms: []
});
```

`result.criteria` always contains one detailed result for each LCBI criterion. Each result exposes status, DOE, seven-day infection window, used specimens/symptoms/organisms, excluded specimens with a reason, missing elements, and the applied rule. Status is `met`, `not met`, or `indeterminate`; callers can route indeterminate inputs to manual review.

## Input contract

- `bloodSpecimens`: uses `specimenNumber` (or `specimenId`/`drawId`), `collectionDate`, `organism`, `method` (`culture` or an NCT), and optionally `specimenType`, `source`, `eligibleNct`, `directFromBlood`, `commonCommensal`, `processedSeparately`, and `reportedSeparately`.
- `symptoms`: repeatable records with `type`, `date`, optional `temperature` and `unit`, plus `note` for source/documentation.
- `organismRelatedToAnotherSite`: explicit boolean. Omitting it produces an indeterminate result because the required exclusion cannot be evaluated.

The evaluator never treats catheter-tip cultures as blood specimens. It tests matching commensals by genus/species and supports complementary genus/species reports; it intentionally does not use collection source, colony morphology, antibiogram, or biotype.
