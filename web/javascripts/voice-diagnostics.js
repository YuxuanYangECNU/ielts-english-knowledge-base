(() => {
  const config = window.IELTS_SPEAKING_CONFIG || {};
  const apiBase = (config.apiBase || "").replace(/\/$/, "");

  function initVoiceDiagnostics() {
    const root = document.querySelector("[data-speaking-voice]");
    if (!root || !apiBase) return;

    const start = root.querySelector("[data-voice-start]");
    const status = root.querySelector("[data-voice-status]");
    const dot = root.querySelector("[data-voice-status-dot]");
    let checking = null;

    function paint(text, kind = "") {
      if (status) status.textContent = text;
      if (dot) {
        dot.classList.remove("is-ready", "is-busy", "is-error");
        if (kind) dot.classList.add(`is-${kind}`);
      }
    }

    function explain(data, httpStatus) {
      if (data?.code === "ASR_SECRET_MISSING") {
        return "Alibaba ASR key is missing in Cloudflare";
      }
      if (data?.code === "ASR_HANDSHAKE_REJECTED") {
        if (httpStatus === 401 || httpStatus === 403) return "Alibaba API key was rejected";
        return `Alibaba ASR rejected the connection${httpStatus ? ` (${httpStatus})` : ""}`;
      }
      if (data?.code === "ASR_UPSTREAM_ERROR") {
        return "Could not reach Alibaba speech recognition";
      }
      return "Speech recognition preflight failed";
    }

    async function preflight() {
      if (checking) return checking;
      checking = (async () => {
        root.dataset.asrReady = "checking";
        paint("Checking speech recognition…", "busy");
        try {
          const response = await fetch(`${apiBase}/api/asr/check`, {
            method: "GET",
            headers: { "Accept": "application/json" },
            cache: "no-store"
          });
          let data = {};
          try { data = await response.json(); } catch (_) {}

          if (response.ok && data.ok) {
            root.dataset.asrReady = "true";
            paint("Speech recognition ready", "ready");
            return true;
          }

          root.dataset.asrReady = "false";
          root.dataset.asrError = explain(data, response.status);
          paint(root.dataset.asrError, "error");
          return false;
        } catch (_) {
          root.dataset.asrReady = "false";
          root.dataset.asrError = "Could not reach the Free Voice backend";
          paint(root.dataset.asrError, "error");
          return false;
        } finally {
          checking = null;
        }
      })();
      return checking;
    }

    if (start) {
      start.addEventListener("click", event => {
        if (root.dataset.asrReady === "false") {
          event.preventDefault();
          event.stopImmediatePropagation();
          preflight();
        }
      }, true);
    }

    if (status) {
      const observer = new MutationObserver(() => {
        if (status.textContent.trim() === "Could not start Free Voice" && root.dataset.asrReady === "true") {
          status.textContent = "ASR is ready — startup failed at the session or microphone step";
        }
      });
      observer.observe(status, { childList: true, characterData: true, subtree: true });
    }

    preflight();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVoiceDiagnostics);
  } else {
    initVoiceDiagnostics();
  }
})();
