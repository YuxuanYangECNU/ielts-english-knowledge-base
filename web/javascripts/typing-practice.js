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
    const meanings = [];
    // Keep each meaning inside its existing white cell/list item, so hiding
    // the text never changes the table layout or removes the cell background.
    function wrapMeaning(parent, nodes) {
      if (!nodes.length || !nodes.some(node => node.textContent.trim())) return;
      const span = document.createElement('span');
      span.className = 'typing-meaning';
      parent.insertBefore(span, nodes[0]);
      nodes.forEach(node => span.append(node));
      meanings.push(span);
    }
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
      function check(submitted = false) {
        const value = normalize(input.value); const correct = !!value && accepted.includes(value);
        const wrong = submitted && !correct;
        box.classList.toggle('is-correct', correct); box.classList.toggle('is-wrong', wrong);
        state.textContent = correct ? '✓' : wrong ? '✗' : '';
        input.setAttribute('aria-invalid', String(wrong));
        input.setAttribute('aria-label', `拼写练习第 ${entries.indexOf(entry) + 1} 项${correct ? '，正确' : wrong ? '，错误，请修改' : ''}`);
        return correct;
      }
      input.addEventListener('input', event => { if (!event.isComposing) check(); });
      input.addEventListener('compositionend', () => check());
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault(); if (!check(true)) return;
        const next = entries.slice(entries.indexOf(entry) + 1).find(e => !e.input.closest('[hidden]') && e.input.getClientRects().length);
        next?.input.focus();
      });
    }
    article.querySelectorAll('table').forEach(table => {
      const headers = [...table.querySelectorAll('thead th')];
      const index = headers.findIndex(h => /^(word(?:\s*\/\s*phrase)?|词[／/]词组|词汇|单词)$/i.test(h.textContent.trim()));
      if (index < 0) return;
      const meaningIndex = headers.findIndex(h => /^(?:meaning(?:s)?|chinese(?:\s+meaning)?|definition(?:s)?|translation|中文(?:速览|释义|意思|含义|翻译)?|释义|词义|含义|意思|翻译)$/i.test(h.textContent.trim()));
      table.classList.add('typing-table');
      const th = document.createElement('th'); th.textContent = '打字练习'; th.scope = 'col'; th.className = 'typing-column'; headers[0].before(th);
      table.querySelectorAll('tbody tr').forEach(row => {
        const target = row.cells[index]; if (!target) return;
        if (meaningIndex >= 0 && row.cells[meaningIndex]) {
          const cell = row.cells[meaningIndex];
          wrapMeaning(cell, [...cell.childNodes]);
        }
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
        // These dedicated vocabulary lists place the meaning immediately
        // after the bold headword, commonly in Chinese parentheses.
        const meaningNodes = [];
        let sibling = target.nextSibling;
        while (sibling) {
          if (sibling.nodeType === 1 && /^(UL|OL|P|DIV|DETAILS)$/.test(sibling.tagName)) break;
          meaningNodes.push(sibling);
          sibling = sibling.nextSibling;
        }
        wrapMeaning(target.parentNode, meaningNodes);
        const host = document.createElement('span'); host.className = 'typing-list-control'; li.prepend(host); add(target, host);
      });
    });
    if (!entries.length) return;
    const bar = document.createElement('div'); bar.className = 'typing-toolbar';
    const label = document.createElement('span'); label.textContent = '打字练习 · 正确亮绿 · 回车检查，正确后下一项';
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.textContent = '隐藏原词'; toggle.setAttribute('aria-pressed','false');
    const meaningToggle = document.createElement('button'); meaningToggle.type = 'button';
    meaningToggle.textContent = '隐藏意思'; meaningToggle.setAttribute('aria-pressed','false');
    meaningToggle.setAttribute('aria-label', '隐藏中文释义或英文定义');
    meaningToggle.addEventListener('click', () => {
      const hidden = article.classList.toggle('typing-hide-meaning');
      meaningToggle.textContent = hidden ? '显示意思' : '隐藏意思';
      meaningToggle.setAttribute('aria-pressed', String(hidden));
      meanings.forEach(node => {
        if (hidden) node.setAttribute('aria-hidden', 'true');
        else node.removeAttribute('aria-hidden');
      });
      syncFloatingControls();
    });
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = '清空重练';
    const note = document.createElement('span'); note.className = 'typing-help'; note.textContent = '大小写不限；词组需完整；斜线并列项可输入任一项或整组。原词与意思可分别隐藏，例句和错因仍可见。刷新后清空。';
    toggle.addEventListener('click', () => {
      const hidden = article.classList.toggle('typing-hide'); toggle.textContent = hidden ? '显示原词' : '隐藏原词'; toggle.setAttribute('aria-pressed',String(hidden));
      entries.forEach(e => { if (hidden) e.target.setAttribute('aria-hidden','true'); else e.target.removeAttribute('aria-hidden'); });
      syncFloatingControls();
    });
    reset.addEventListener('click', () => { entries.forEach(e => { e.input.value = ''; e.input.dispatchEvent(new Event('input')); }); });
    bar.append(label,toggle);
    if (meanings.length) bar.append(meaningToggle);
    bar.append(reset,note);
    const title = article.querySelector('h1'); if (title) title.after(bar); else article.prepend(bar);

    // Compact controls remain available after the top toolbar scrolls away.
    // These click the original buttons, keeping both sets in the same state.
    const floating = document.createElement('div');
    floating.className = 'typing-floating-controls';
    floating.setAttribute('role', 'group');
    floating.setAttribute('aria-label', '随时切换单词和意思的显示');
    floating.hidden = true;
    const floatingWord = document.createElement('button');
    floatingWord.type = 'button';
    floatingWord.addEventListener('click', () => toggle.click());
    floating.append(floatingWord);
    let floatingMeaning = null;
    if (meanings.length) {
      floatingMeaning = document.createElement('button');
      floatingMeaning.type = 'button';
      floatingMeaning.addEventListener('click', () => meaningToggle.click());
      floating.append(floatingMeaning);
    }
    article.append(floating);

    function syncFloatingControls() {
      floatingWord.textContent = toggle.textContent;
      floatingWord.setAttribute('aria-pressed', toggle.getAttribute('aria-pressed'));
      if (floatingMeaning) {
        floatingMeaning.textContent = meaningToggle.textContent;
        floatingMeaning.setAttribute('aria-pressed', meaningToggle.getAttribute('aria-pressed'));
      }
    }
    syncFloatingControls();

    // Only appear when the original bar has left the viewport above us.
    // Hide again near the article footer to avoid covering navigation links.
    function updateFloatingVisibility() {
      if (!article.isConnected) {
        window.removeEventListener('scroll', updateFloatingVisibility);
        window.removeEventListener('resize', updateFloatingVisibility);
        return;
      }
      floating.hidden = !(bar.getBoundingClientRect().bottom < 72 &&
        article.getBoundingClientRect().bottom > 128);
    }
    window.addEventListener('scroll', updateFloatingVisibility, { passive: true });
    window.addEventListener('resize', updateFloatingVisibility);
    updateFloatingVisibility();
  }
  // Pure matcher exports allow checking edge cases without loading a browser.
  if (typeof module !== 'undefined' && module.exports) module.exports = {normalize, answers};
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init); else init();
    if (typeof document$ !== 'undefined') document$.subscribe(init);
  }
})();
