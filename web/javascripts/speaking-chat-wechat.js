(() => {
  function initWechatChatControls() {
    const root = document.querySelector("[data-speaking-chat]");
    if (!root || root.dataset.wechatKeysReady === "true") return;

    const form = root.querySelector("[data-chat-form]");
    const input = root.querySelector("[data-chat-input]");
    if (!form || !input) return;

    root.dataset.wechatKeysReady = "true";

    function resizeInput() {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
      input.style.overflowY = input.scrollHeight > 132 ? "auto" : "hidden";
    }

    input.addEventListener("input", resizeInput);

    input.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.isComposing) return;

      if (event.shiftKey) {
        // Shift + Enter keeps the browser default: insert a newline.
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
      window.requestAnimationFrame(() => {
        input.style.height = "auto";
        resizeInput();
      });
    });

    resizeInput();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWechatChatControls);
  } else {
    initWechatChatControls();
  }
})();
