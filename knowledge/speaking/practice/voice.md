[← Practice](README.md) · [Practice rules](../PRACTICE_RULES.md)

# Voice Practice · 语音实战

<div class="speaking-mode-grid">
  <section class="speaking-mode-panel">
    <span class="speaking-practice-card-tag">BEST EXPERIENCE</span>
    <h2>ChatGPT Voice</h2>
    <p>Use the dedicated IELTS Speaking ChatGPT Project. Topic setup and final review use GPT-5.6 Sol · Instant; the live conversation uses ChatGPT Voice.</p>
    <a class="md-button md-button--primary" href="https://chatgpt.com/" target="_blank" rel="noopener">Open ChatGPT</a>
    <p class="speaking-small-note">This route opens ChatGPT because ChatGPT Voice itself cannot be embedded directly inside this GitHub Pages site.</p>
  </section>

  <section class="speaking-mode-panel speaking-free-voice-panel" data-speaking-voice>
    <span class="speaking-practice-card-tag">FREE ROUTE</span>
    <h2>Free Voice</h2>
    <p>Paraformer realtime speech recognition → GLM-4.7-Flash → British-English speech output.</p>

    <div class="speaking-status-row speaking-voice-status-card">
      <span class="speaking-status-dot" data-voice-status-dot></span>
      <span data-voice-status>Ready to connect</span>
    </div>

    <div class="speaking-topic-chip" data-voice-topic>Today’s IELTS topic will appear here</div>

    <div class="speaking-voice-orb" aria-hidden="true"><span></span></div>

    <div class="speaking-voice-actions speaking-voice-actions-polished">
      <button class="speaking-voice-start" type="button" data-voice-start>
        <span class="speaking-mic-icon" aria-hidden="true"></span>
        <span class="speaking-voice-start-copy">
          <strong>Start Free Voice</strong>
          <small>Tap once, then just speak naturally</small>
        </span>
      </button>
      <button class="speaking-action-button speaking-stop-button" type="button" data-voice-stop disabled>End session</button>
    </div>

    <div class="speaking-voice-live">
      <div class="speaking-voice-live-header">
        <strong>Live conversation</strong>
        <span>Realtime transcript</span>
      </div>
      <div class="speaking-voice-interim" data-voice-interim>Listening for your English…</div>
      <div class="speaking-voice-messages" data-voice-messages>
        <p class="speaking-empty-state">Tap Start Free Voice to begin.</p>
      </div>
    </div>

    <p class="speaking-small-note">Target: iPhone Safari + Android Chrome. British English is the default voice. Your microphone audio is sent to Alibaba Cloud for realtime speech recognition; the API key remains protected in Cloudflare.</p>
  </section>
</div>

## Session behaviour

- one recent Mainland China IELTS topic per session;
- English conversation by default;
- let the user finish before correcting;
- important correction: concise Chinese explanation + improved English;
- no fixed duration;
- you can speak while the coach is talking to interrupt it;
- final recap starts after **“结束今天的练习”**.
