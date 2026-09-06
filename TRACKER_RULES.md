[← Authoring rules](AUTHORING_RULES.md) · [Vocabulary tracker](knowledge/vocabulary/README.md)

# Structured Learning Tracker Rules · 结构化学习表规则

These rules apply whenever a learning section accumulates repeatable items over time. They extend the repository-wide authoring rules and are designed to keep daily learning, weekly review and web interaction consistent.

## 1 · Core model

Prefer a **stable, filterable tracker** rather than disconnected daily notes.

The reusable pattern is:

**stable content fields → editable learning status → separate weak/review marker → filters → cumulative history**

Content and review state must remain separate. Do not overwrite the original learning item merely because its mastery changes.

## 2 · Vocabulary schema

Vocabulary uses the fixed fields:

**No. → Word / Phrase → Part of speech → Meaning → Mastery → Weekly unfamiliar**

- Keep numbering continuous and stable.
- Current pace: **30 new words per training day**.
- Default mastery options: **Unfamiliar / Learning / Usable / Mastered**.
- The mastery value can be changed directly on the website and filtered immediately.
- Website mastery edits may use browser-local storage for interaction.
- The GitHub repository remains the cross-device source of truth for the vocabulary list and weekly unfamiliar history.

## 3 · Daily update rule

Monday–Saturday:

1. Read that day’s valid IELTS study email.
2. Extract the day’s 30 vocabulary items exactly once.
3. Append them to the existing vocabulary tracker rather than creating a separate word-list page.
4. Preserve `No. / Word / POS / Meaning` consistently.
5. New items default to **Learning** unless the user has already identified them as unfamiliar.
6. Avoid duplicate rows when a word reappears in later source material; preserve the learning history instead of silently creating conflicting duplicates.

Sunday:

- do not add new vocabulary;
- use the user’s weekly review feedback to mark unfamiliar words.

## 4 · Weekly unfamiliar history

The **Weekly unfamiliar** field is independent of current mastery.

- If the user marks a word unfamiliar during Week 1, record `Week 1`.
- If the same word is weak again in Week 3, retain both weeks rather than replacing the earlier marker.
- A user may later change Mastery to `Usable` or `Mastered`; the historical weekly weak marker must remain available for review analysis.
- Filters must allow `all words`, `current mastery`, and `weekly unfamiliar only` views.

## 5 · Other IELTS sections

Reuse the same interaction and review logic, but do **not** force vocabulary-specific columns onto unrelated content.

Examples:

- Reading: `Source / Question type / Paraphrase / Trap or logic / Mastery / Weak-review marker`
- Listening: `Scenario / Expression or signal / Recognition issue / Mastery / Weak-review marker`
- Speaking: `Topic / Pattern / Personal usable sentence / Mastery / Weak-review marker`
- Writing: `Function / Expression / Condition of use / Mastery / Weak-review marker`

The principle is always:

**stable fields + editable status + separate weak-item history + filters + cumulative review**.

## 6 · Web behaviour

For a tracker page where interaction is useful:

- provide text search;
- provide mastery/status filtering;
- provide weak/review filtering;
- keep controls usable on mobile;
- preserve a clean, compact table layout;
- avoid turning the site into a large dashboard when a simple tracker is enough.

## 7 · Update safety

Before every automated or manual update:

- read the existing tracker first;
- append/update only the intended records;
- preserve existing mastery and weak-history data;
- do not renumber older rows;
- do not erase earlier weekly markers;
- avoid duplicate imports;
- keep the site build-compatible with MkDocs and GitHub Pages.
