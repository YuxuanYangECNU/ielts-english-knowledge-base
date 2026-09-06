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
  const persist = () => localStorage.setItem(storageKey, JSON.stringify(saved));
  const apply = () => {
    const q = (search?.value || "").trim().toLowerCase();
    const wantedStatus = statusFilter?.value || "all";
    const wantedWeek = weekFilter?.value || "all";
    rows.forEach((row) => {
      const select = row.querySelector(".mastery-select");
      const status = select?.value || row.dataset.status || "Learning";
      const week = row.dataset.week || "—";
      const matchesSearch = !q || row.textContent.toLowerCase().includes(q);
      const matchesStatus = wantedStatus === "all" || status === wantedStatus;
      const matchesWeek = wantedWeek === "all" || (wantedWeek === "flagged" && week !== "—") || week === wantedWeek;
      row.hidden = !(matchesSearch && matchesStatus && matchesWeek);
      row.dataset.status = status;
    });
  };
  rows.forEach((row) => {
    const select = row.querySelector(".mastery-select");
    if (!select) return;
    const id = select.dataset.vocabId;
    if (saved[id]) select.value = saved[id];
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
