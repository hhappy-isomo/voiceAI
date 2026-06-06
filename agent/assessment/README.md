# Speaking assessment (pre/post)

Measures oral-fluency change, Week 0 vs Week 6. Internal measure, externally validated.

- **`Assessment_Speaking_Task.txt`** — the agent prompt that elicits a standardized, recorded
  speech sample. Run it IDENTICALLY in Week 0 and Week 6. This agent does NOT teach or correct —
  it only elicits, so the samples are comparable.
- **`../../docs/Isomo_CEFR_Speaking_Rubric.docx`** — facilitators score the recording on 5 CEFR
  dimensions → one overall level → entered in the dashboard (`assessments`, instrument `rubric`).

## The full assessment stack
| Layer | Instrument | When | Note |
|---|---|---|---|
| Internal (rich) | Agent task → CEFR rubric | Wk 0 + Wk 6 | the change |
| External cross-check | DET free practice | Wk 0 + Wk 6 | free, repeatable |
| External validation | EF SET (free, official) | Wk 6 only | correlate vs rubric to validate it |
| Grammar | IXL SmartScore | ongoing | already owned |
| Confidence | Questionnaire | Wk 0 + Wk 6 | Google Form |

Double-rate ~10 recordings with a second facilitator for reliability; score blind to PRE/POST.
