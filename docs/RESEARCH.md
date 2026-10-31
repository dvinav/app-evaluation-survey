# Research use and analytical exports

## Study boundary

The platform collects application evaluations from participants. Companies first agree to participate in hiring-manager interviews; the researcher then independently selects which applications become public. Interviews and qualitative recruitment-practice analysis happen outside this application. Company participation does not automatically publish applications, and application rankings are not rankings of employers or proof of hiring quality.

The researcher supplies the final questionnaire and its justification. Demonstration questions are marked synthetic and unvalidated. Seven-point agreement scales alone do not establish construct validity, reliability, interval measurement, representative sampling, or comparability between instruments. Obtain the required permissions for any published research instrument and follow the relevant ethics protocol.

## Modes, subsets, and dependence

General and detailed questions are separate collections/instruments. Each mode supports up to 100 active questions and 100 eligible applications. The signed token is limited to 300,000 characters and submission bodies to 512,000 bytes; test the final configured instrument before opening collection. A participant selects exactly one mode, then any nonempty subset of eligible applications they have used. Every selected application receives the same question snapshot in the configured order. Application-specific question overrides are not supported.

The respondent is the shared unit when one person evaluates multiple applications; those observations should not automatically be treated as statistically independent. Application samples can differ in composition, familiarity, specialist background, questionnaire mode, and size. Voluntary repeat participation is possible. The system prevents retry duplicates but does not identify repeat individuals or prevent deliberate resubmission. Self-selection, order effects, and missingness need explicit methodological treatment.

## Descriptive scoring

Raw numeric answers are integers from 1 (کاملاً مخالفم) to 7 (کاملاً موافقم). Explicit non-applicable responses and unanswered optional questions have null ratings with different statuses. NA does not satisfy a required question unless that question explicitly allows it.

For the convenience dashboard:

1. Exclude null, unanswered, and NA responses from numeric means.
2. For each question marked reverse-scored, compute an adjusted value `8 - raw_rating`, without changing raw storage.
3. Within each respondent/application/mode/version/dimension, average the numeric adjusted answers. An application score for a whole instrument is also provided as a transparent descriptive composite; it is not a validated latent construct and should not substitute for separate dimension analysis.
4. Average these respondent-level scores with equal respondent weights. Report their median as well. Exclude respondent/application records with no numeric score, showing their count separately.
5. Rank within the same mode, instrument version, and dimension only. Ties share the same competition rank. No ranks cross these strata.

The dashboard reports valid respondent-score counts, excluded evaluations, unanswered counts, and NA counts. A warning below ten valid evaluations is only a display heuristic. No minimum sample size or statistical power is implied. Required-question validation does not guarantee substantive answer quality. The convenience mean assumes a scoring treatment that must be justified in your methodology; ordinal modeling, validated subscale rules, minimum completed-item thresholds, or other analyses may be more appropriate.

Different question versions remain separate, even if wording changes seem minor. There is no configured cross-mode or cross-version common scoring model. Confidence intervals, hypothesis tests, causal models, instrument calibration, reliability estimation, and interview comparison are left to the researcher.

## Download behavior

The admin dashboard offers CSV and JSON with response date/mode filters. `/api/research/export` accepts `dataset`, `format`, optional inclusive UTC `from`/`to` dates (`YYYY-MM-DD`), optional `mode` (`general` or `detailed`), and optional numeric `application` ID. Authentication is mandatory. The configuration datasets ignore response filters; applications/companies include inactive/nonparticipating records to preserve study administration context.

CSV is UTF-8 with BOM and CRLF, quotes/escapes every field, and prefixes potentially executable text with an apostrophe for spreadsheet safety. Numeric scores serialize as numeric values; use an explicit numeric column type if your spreadsheet's import wizard does not infer it. JSON retains native numbers/booleans/nulls and is preferable for exact machine processing. Empty CSV exports still include columns. Raw JSON text fields are not formula-neutralized because they are not spreadsheet formulas.

Exports/statistics are a consistent repeatable-read snapshot. For moderate study sizes all records are paginated from the database and joined in server memory. No silent record cap is imposed; memory and response time still constrain very large datasets. Downloaded files are sensitive research records. Protect them and avoid posting exports to the public repository.

## Flattened column dictionary

### Participant dataset (`participants`)

| Column                  | Meaning                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `submission_id`         | Opaque submission UUID; groups repeated application evaluations by the same session |
| `submitted_at`          | UTC server creation timestamp                                                       |
| `background`            | `ui-ux`, `software`, or `other`                                                     |
| `questionnaire_mode`    | `general` or `detailed`                                                             |
| `questionnaire_version` | SHA-256 of mode, ordered question snapshot, and scale                               |
| `consent_version`       | Researcher-configured consent identifier                                            |
| `consented_at`          | UTC server acknowledgment at submission                                             |

Names, profile URLs, email, and request hashes are excluded. A UUID is a session identifier, not a person identifier.

### Evaluation dataset (`evaluations`)

| Column                                        | Meaning                                           |
| --------------------------------------------- | ------------------------------------------------- |
| `evaluation_id`, `submission_id`              | Internal evaluation ID and parent submission UUID |
| `application_id`, `application_name`          | Application identity and name at submission       |
| `company_id`, `company_name`                  | Company identity and name at submission           |
| `questionnaire_mode`, `questionnaire_version` | Instrument stratum                                |
| `evaluated_at`                                | UTC evaluation-record timestamp                   |
| `question_count`                              | Number of questions in the administered snapshot  |

### Answer dataset (`answers`)

| Column                                                           | Meaning                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `submission_id`, `evaluation_id`, `application_id`, `company_id` | Relational analysis keys                                                 |
| `questionnaire_mode`, `questionnaire_version`                    | Instrument stratum                                                       |
| `question_id`, `question_text`, `question_version`               | Stable identifier and exact historical question content/version          |
| `dimension`                                                      | Optional researcher-defined construct; empty when unspecified            |
| `required`                                                       | Required status at administration                                        |
| `raw_rating`                                                     | Untransformed integer 1–7, or null                                       |
| `response_status`                                                | `rated`, `not-applicable`, or `unanswered`                               |
| `not_applicable`                                                 | Boolean explicit NA flag                                                 |
| `reverse_scored`                                                 | Boolean instruction for separate derived scoring                         |
| `scale_min`, `scale_max`                                         | 1 and 7                                                                  |
| `answered_at`                                                    | UTC server storage timestamp, not a browser-estimated answering duration |

Never convert NA or unanswered rows into zero. Do not reconstruct historical wording from live question exports.

### Company dataset (`companies`)

`company_id`, `company_name`, `website`, `participation_status`, `interview_agreement`, `interview_progress`. Private notes are excluded. Use `company_id` to join later interview coding under an approved research protocol. This is the current company-administration state; historical application/company names remain in evaluations.

### Application dataset (`applications`)

`application_id`, `application_name`, `company_id`, `url`, `category`, `active`, `public`, `display_order`. These are current application configuration values.

### Question datasets (`generalQuestions`, `detailedQuestions`)

`question_id`, `question_text`, `question_version`, `description`, `dimension`, `reverse_scored`, `required`, `allow_na`, `active`, `display_order`. These are current question definitions, not the historical administered instrument. Keep the mode in the dataset filename when combining current question catalogs outside this system.

## Reproducibility practices

Archive the application revision, migration revision, instrument definitions, consent revision, export timestamp and filters, scoring code, exclusion rules, and analysis environment with the study's protected records. Document revisions prospectively. Keep raw exports unchanged and compute adjustments in separate analysis outputs. Treat descriptive rankings as summaries of the observed sample, with uncertainty and research design limitations clearly stated.
