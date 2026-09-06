[← Knowledge map](../README.md) · [Home](../../README.md)

# Vocabulary Tracker · 词汇学习表

This page is the **daily vocabulary learning tracker**. New IELTS vocabulary is appended here after each study day, while weekly unfamiliar words are marked separately so they can be filtered and reviewed.

<div class="vocab-summary">
  <div><strong>__VOCAB_TOTAL__</strong><span>words learned</span></div>
  <div><strong>__VOCAB_WEEKLY_TOTAL__</strong><span>weekly unfamiliar records</span></div>
  <div><strong>30/day</strong><span>current pace</span></div>
</div>

<div class="vocab-controls">
  <input id="vocab-search" type="search" placeholder="Search word or meaning…" aria-label="Search vocabulary">
  <select id="vocab-status-filter" aria-label="Filter by mastery">
    <option value="all">All mastery levels</option>
    <option value="Unfamiliar">Unfamiliar</option>
    <option value="Learning">Learning</option>
    <option value="Usable">Usable</option>
    <option value="Mastered">Mastered</option>
  </select>
  <select id="vocab-week-filter" aria-label="Filter by weekly unfamiliar flag">
    <option value="all">All weekly flags</option>
    <option value="flagged">Weekly unfamiliar only</option>
    __VOCAB_WEEK_OPTIONS__
  </select>
  <button id="vocab-reset" class="md-button">Reset filters</button>
</div>

<div class="vocab-note">
<strong>How it works.</strong> Change <em>Mastery</em> directly on this page. Your selection is saved in this browser and is immediately available to the filters above. The <em>Weekly unfamiliar</em> column is repository data: it is updated from the weekly review so the same weak-word history is visible on every device.
</div>

<div class="vocab-table-wrap">
<table id="vocab-table">
<thead><tr><th>No.</th><th>Word / Phrase</th><th>POS</th><th>Meaning</th><th>Mastery</th><th>Weekly unfamiliar</th></tr></thead>
<tbody>
__VOCAB_ROWS__
</tbody>
</table>
</div>

## Update rhythm

- **Monday–Saturday:** append that day’s 30 new words to `vocab.tsv` after the daily IELTS study material is generated.
- **Sunday:** do not add new words; add that week’s unfamiliar-word IDs to `weekly_unfamiliar.tsv` from the user’s review feedback.
- Never delete an older weak-word marker when a later week is added. Weekly history accumulates.
- The web-page mastery selector is personal browser state; the repository remains the cross-device source of truth for the word list and weekly unfamiliar history.

## Data schema

Vocabulary source data uses stable fields:

**No. → Word / Phrase → Part of speech → Meaning**

The site adds two learning-state fields:

**Mastery → Weekly unfamiliar**

This structure is intentionally reusable: other learning sections should also prefer stable content fields, an editable learning status where appropriate, filterable views, and a separate weak-item/review marker rather than mixing review state into the learning content itself.
