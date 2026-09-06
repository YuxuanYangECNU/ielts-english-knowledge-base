(() => {
  function initWechatChatControls() {
    const root = document.querySelector("[data-speaking-chat]");
    if (!root || root.dataset.wechatKeysReady === "true") return;

    const form = root.querySelector("[data-chat-form]");
    const input = root.querySelector("[data-chat-input]");
    const messages = root.querySelector("[data-chat-messages]");
    const status = root.querySelector("[data-chat-status]");
    const endButton = root.querySelector("[data-chat-end]");
    if (!form || !input || !messages) return;

    root.dataset.wechatKeysReady = "true";
    let typingTimer = null;

    function resizeInput() {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
      input.style.overflowY = input.scrollHeight > 132 ? "auto" : "hidden";
    }

    function removeTyping() {
      if (typingTimer) {
        window.clearTimeout(typingTimer);
        typingTimer = null;
      }
      root.querySelector("[data-chat-typing]")?.remove();
    }

    function showTyping() {
      removeTyping();
      typingTimer = window.setTimeout(() => {
        if (!status || !/Thinking/i.test(status.textContent || "")) return;
        if (root.querySelector("[data-chat-typing]")) return;

        const row = document.createElement("div");
        row.className = "speaking-message speaking-message-ai speaking-chat-typing";
        row.dataset.chatTyping = "true";
        row.innerHTML = '<div class="speaking-message-label">Coach</div><div class="speaking-typing-dots" aria-label="Coach is typing"><span></span><span></span><span></span></div>';
        messages.appendChild(row);
        messages.scrollTop = messages.scrollHeight;
      }, 220);
    }

    input.addEventListener("input", resizeInput);

    input.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.isComposing) return;

      if (event.shiftKey) {
        window.requestAnimationFrame(resizeInput);
        return;
      }

      event.preventDefault();
      if (!input.value.trim()) return;
      form.requestSubmit();
      window.requestAnimationFrame(() => {
        input.style.height = "auto";
        resizeInput();
      });
    });

    form.addEventListener("submit", () => {
      showTyping();
      window.requestAnimationFrame(() => {
        input.style.height = "auto";
        resizeInput();
      });
    });

    if (endButton) {
      endButton.addEventListener("click", () => {
        if (/Thinking/i.test(status?.textContent || "")) return;
        input.value = "结束今天的练习";
        resizeInput();
        form.requestSubmit();
      });
    }

    if (status) {
      const observer = new MutationObserver(() => {
        if (!/Thinking/i.test(status.textContent || "")) removeTyping();
      });
      observer.observe(status, { childList: true, characterData: true, subtree: true });
    }

    const messageObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches?.(".speaking-message-user")) {
            node.classList.add("speaking-message-enter-user");
            messages.scrollTop = messages.scrollHeight;
          }
          if (node.matches?.(".speaking-message-ai") && !node.matches?.("[data-chat-typing]")) {
            removeTyping();
            node.classList.add("speaking-message-enter-ai");
            messages.scrollTop = messages.scrollHeight;
          }
        }
      }
    });
    messageObserver.observe(messages, { childList: true });

    resizeInput();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWechatChatControls);
  } else {
    initWechatChatControls();
  }
})();
