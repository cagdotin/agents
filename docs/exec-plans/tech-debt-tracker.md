# Tech Debt Tracker

Status: active  
Last updated: 2026-03-07

This file tracks known debt surfaced during architecture/quality review.

Related:
- [[docs/QUALITY]]
- [[docs/exec-plans/completed/2026-03-06-harness-alignment-plan]]
- [[docs/references/pi-api-reference]]

---

## P0 Debt

- None currently.

---

## P1 Debt

## 1) Expert domain matching precision

Impact:
- Potentially wrong/missing expertise injection.

Planned remediation:
- Implement R9 matching improvements.

## 2) Expertise context budget safeguards

Impact:
- Potential context overuse and degraded generation quality.

Planned remediation:
- Implement R9 budget checks before injection.

## 3) Expert command UX gaps

Impact:
- More operator friction than necessary for reflection workflows.

Planned remediation:
- Implement R9 UX sub-items.

---

## P2 Debt

## 4) Spec/plan discipline consistency for complex extension roadmap items

Impact:
- Higher risk of rework and architectural drift if teams skip planning artifacts during fast execution.

Planned remediation:
- R10 infrastructure is complete (`plan` supports spec + execution-plan generation); enforce consistent usage per initiative.
