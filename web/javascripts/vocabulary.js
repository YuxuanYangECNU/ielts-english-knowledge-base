document.addEventListener("DOMContentLoaded", () => {
  const table = document.getElementById("vocab-table");
  if (!table) return;
  const search = document.getElementById("vocab-search");
  const statusFilter = document.getElementById("vocab-status-filter");
  const weekFilter = document.getElementById("vocab-week-filter");
  const reset = document.getElementById("vocab-reset");
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  const storageKey = "ielts-atlas-vocab-mastery-v1";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch (_) { saved = {}; }
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
  const feedback = document.createElement("p");
  feedback.className = "vocab-results-feedback";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  table.closest(".vocab-table-wrap").before(feedback);
  let storageUnavailable = false;
  const persist = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); storageUnavailable = false; }
    catch (_) { storageUnavailable = true; }
  };
  const apply = () => {
    const q = (search?.value || "").trim().toLowerCase();
    const wantedStatus = statusFilter?.value || "all";
    const wantedWeek = weekFilter?.value || "all";
    let visible = 0;
    rows.forEach((row) => {
      const select = row.querySelector(".mastery-select");
      const status = select?.value || row.dataset.status || "Learning";
      const week = row.dataset.week || "—";
      const matchesSearch = !q || Array.from(row.cells).slice(0, 4).map(cell => cell.textContent).join(" ").toLowerCase().includes(q);
      const matchesStatus = wantedStatus === "all" || status === wantedStatus;
      const matchesWeek = wantedWeek === "all" || (wantedWeek === "flagged" && week !== "—") || week.split(",").map(value => value.trim()).includes(wantedWeek);
      row.hidden = !(matchesSearch && matchesStatus && matchesWeek);
      row.dataset.status = status;
      if (!row.hidden) visible += 1;
    });
    feedback.textContent = visible
      ? `Showing ${visible} of ${rows.length} words`
      : "No matching words. Try another search or reset the filters.";
    if (storageUnavailable) feedback.textContent += " Changes are kept for this visit only; browser storage is unavailable.";
  };
  rows.forEach((row) => {
    const select = row.querySelector(".mastery-select");
    if (!select) return;
    const id = select.dataset.vocabId;
    select.setAttribute("aria-label", `Mastery for ${row.dataset.word}`);
    if (Array.from(select.options).some(option => option.value === saved[id])) select.value = saved[id];
    row.dataset.status = select.value;
    select.addEventListener("change", () => { saved[id] = select.value; persist(); apply(); });
  });
  [search, statusFilter, weekFilter].forEach((el) => {
    if (!el) return;
    el.addEventListener(el.tagName === "INPUT" ? "input" : "change", apply);
  });
  reset?.addEventListener("click", () => {
    if (search) search.value = "";
    if (statusFilter) statusFilter.value = "all";
    if (weekFilter) weekFilter.value = "all";
    apply();
  });
  apply();
});
