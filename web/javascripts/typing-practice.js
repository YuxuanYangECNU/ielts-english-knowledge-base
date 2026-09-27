/* Local-only spelling practice. No typing data is sent or changes mastery. */
(function () {
  const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[‐‑–—]/g, '-').trim().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, ' / ');
  function answers(text) {
    const clean = text.replace(/[★○]/g, '').trim();
    return [...new Set([clean, ...clean.split(/\s*\/\s*/)].map(normalize).filter(Boolean))];
  }
  function init() {
    const article = document.querySelector('article');
    if (!article || article.dataset.typingReady) return;
    article.dataset.typingReady = 'true';
    const entries = [];
    function add(target, host) {
      const accepted = answers(target.textContent);
      if (!accepted.length || !/[a-z]/i.test(accepted[0])) return;
      target.classList.add('typing-target');
      const box = document.createElement('span'); box.className = 'typing-box';
      const input = document.createElement('input'); input.type = 'text'; input.className = 'typing-input';
      input.setAttribute('aria-label', `拼写练习第 ${entries.length + 1} 项`);
      input.placeholder = '在这里输入'; input.autocomplete = 'off'; input.spellcheck = false;
      input.setAttribute('autocorrect', 'off'); input.setAttribute('autocapitalize', 'off');
      const state = document.createElement('span'); state.className = 'typing-state'; state.setAttribute('aria-live', 'polite');
      box.append(input, state); host.append(box);
      const entry = { input, box, state, target, accepted }; entries.push(entry);
      function check() {
        const value = normalize(input.value); const correct = !!value && accepted.includes(value);
        box.classList.toggle('is-correct', correct); state.textContent = correct ? '✓' : '';
        input.setAttribute('aria-label', `拼写练习第 ${entries.indexOf(entry) + 1} 项${correct ? '，正确' : ''}`);
      }
      input.addEventListener('input', event => { if (!event.isComposing) check(); });
      input.addEventListener('compositionend', check);
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault(); check();
        const next = entries.slice(entries.indexOf(entry) + 1).find(e => !e.input.closest('[hidden]') && e.input.getClientRects().length);
        next?.input.focus();
      });
    }
    article.querySelectorAll('table').forEach(table => {
      const headers = [...table.querySelectorAll('thead th')];
      const index = headers.findIndex(h => /^(word(?:\s*\/\s*phrase)?|词[／/]词组|词汇|单词)$/i.test(h.textContent.trim()));
      if (index < 0) return;
      table.classList.add('typing-table');
      const th = document.createElement('th'); th.textContent = '打字练习'; th.scope = 'col'; th.className = 'typing-column'; headers[0].before(th);
      table.querySelectorAll('tbody tr').forEach(row => {
        const target = row.cells[index]; if (!target) return;
        const td = document.createElement('td'); td.className = 'typing-column'; td.dataset.label = '打字练习';
        row.prepend(td); add(target, td);
      });
    });
    // Reading explanations stay folded; only their dedicated vocabulary lists gain inputs.
    article.querySelectorAll('h2,h3,h4').forEach(heading => {
      if (!/^Vocabulary\s*[·:]/i.test(heading.textContent.trim())) return;
      const list = heading.nextElementSibling;
      if (!list || list.tagName !== 'UL') return;
      list.classList.add('typing-list');
      [...list.children].forEach(li => {
        const target = li.querySelector('strong'); if (!target) return;
        const host = document.createElement('span'); host.className = 'typing-list-control'; li.prepend(host); add(target, host);
      });
    });
    if (!entries.length) return;
    const bar = document.createElement('div'); bar.className = 'typing-toolbar';
    const label = document.createElement('span'); label.textContent = '打字练习 · 正确亮绿 · Enter 下一项';
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.textContent = '隐藏原词'; toggle.setAttribute('aria-pressed','false');
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = '清空重练';
    const note = document.createElement('span'); note.className = 'typing-help'; note.textContent = '大小写不限；词组需完整；斜线并列项可输入任一项或整组。仅隐藏原词，例句和错因仍可见。刷新后清空。';
    toggle.addEventListener('click', () => {
      const hidden = article.classList.toggle('typing-hide'); toggle.textContent = hidden ? '显示原词' : '隐藏原词'; toggle.setAttribute('aria-pressed',String(hidden));
      entries.forEach(e => { if (hidden) e.target.setAttribute('aria-hidden','true'); else e.target.removeAttribute('aria-hidden'); });
    });
    reset.addEventListener('click', () => { entries.forEach(e => { e.input.value = ''; e.input.dispatchEvent(new Event('input')); }); });
    bar.append(label,toggle,reset,note);
    const title = article.querySelector('h1'); if (title) title.after(bar); else article.prepend(bar);
  }
  // Pure matcher exports allow checking edge cases without loading a browser.
  if (typeof module !== 'undefined' && module.exports) module.exports = {normalize, answers};
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init); else init();
    if (typeof document$ !== 'undefined') document$.subscribe(init);
  }
})();
