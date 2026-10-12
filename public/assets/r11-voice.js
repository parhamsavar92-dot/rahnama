/* ==========================================================================
   رهنما — صدا و تماس زندهٔ کلاس مجازی  |  assets/r11-voice.js
   --------------------------------------------------------------------------
   روی صفحهٔ کلاس مجازی (وقتی جلسه شروع شده) این‌ها را اضافه می‌کند:
     • 🎤 پیام صوتی: ضبط کن، بفرست، همهٔ کلاس همان لحظه می‌شنوند
     • 📞 اتاق صدای زنده: چند نفر هم‌زمان و بی‌واسطه با هم حرف می‌زنند
     • 🔇 بی‌صدا / خروج / نمایش وضعیت هر نفر

   مثل hk-class-live.js جدا نوشته شده تا کد فعلی کلاس دست‌نخورده بماند.

   صدا در تماس زنده مستقیماً بین مرورگرها (WebRTC) رد و بدل می‌شود؛
   سرور فقط «چه کسانی حاضرند» و پیام‌های معرفی/آدرس (offer/answer/ICE)
   را جابه‌جا می‌کند. پس صدای شما از سرور عبور نمی‌کند.
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  if (!W.RTCPeerConnection) { /* مرورگر پشتیبانی نمی‌کند؛ فقط ویس کار می‌کند */ }
  function $(s, r) { return (r || D).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(m) { try { W.HK && W.HK.toast ? W.HK.toast(m) : null; } catch (e) { } }
  function fa(n) { return String(n == null ? 0 : n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; }); }

  function CLS() { return (W.HK && W.HK.Class) || null; }
  function SID() { var c = CLS() && CLS().state; return c && c.session ? c.session.id : ""; }
  function ME() { var c = CLS() && CLS().state; return c && c.me ? c.me : (W.HK && W.HK.auth && W.HK.auth.me ? W.HK.auth.me() : null); }
  function api(m, p, b) { var k = CLS(); return k && k.api ? k.api(m, p, b) : Promise.resolve(null); }

  /* شناسهٔ ثابتِ این دستگاه در این زبانه — برای تماس زنده */
  var PID = "";
  try {
    PID = sessionStorage.getItem("r11:pid") || "";
    if (!PID) {
      PID = "p" + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("r11:pid", PID);
    }
  } catch (e) { PID = "p" + Math.random().toString(36).slice(2, 10); }

  /* ══════════════════════════════ ۱. پیام صوتی ══════════════════════════════ */
  var rec = null, chunks = [], t0 = 0, tickT = 0, stream = null;

  function canRecord() {
    return !!(W.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
      W.MediaRecorder && !ended());
  }
  function ended() {
    var c = CLS() && CLS().state;
    return !!(c && c.session && (c.session.status === "ended" || c.session.ended));
  }

  function startRec() {
    if (!canRecord()) { toast("ضبط صدا در این دستگاه پشتیبانی نمی‌شود"); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
      stream = st;
      chunks = [];
      try { rec = new MediaRecorder(st); } catch (e) { try { rec = new MediaRecorder(st, { mimeType: "audio/webm" }); } catch (e2) { } }
      if (!rec) { toast("ضبط صدا ممکن نشد"); return; }
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
      rec.onstop = sendVoice;
      rec.start();
      t0 = Date.now();
      paintRecBtn(true);
      tickT = setInterval(function () {
        var sec = Math.floor((Date.now() - t0) / 1000);
        var el = $("#r11RecT");
        if (el) el.textContent = fa(sec) + " ثانیه — برای پایان، دوباره بزن";
        if (sec >= 30) stopRec();          // سقف ۳۰ ثانیه
      }, 500);
    }).catch(function () {
      toast("دسترسی به میکروفون داده نشد. در تنظیمات مرورگر اجازه بده.");
    });
  }

  function stopRec() {
    if (tickT) { clearInterval(tickT); tickT = 0; }
    try { if (rec && rec.state !== "inactive") rec.stop(); } catch (e) { }
    paintRecBtn(false);
  }

  function sendVoice() {
    var secs = Math.round((Date.now() - t0) / 1000);
    try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { }
    stream = null; rec = null;
    if (!chunks.length) { toast("صدایی ضبط نشد"); return; }
    var blob = new Blob(chunks, { type: (chunks[0] && chunks[0].type) || "audio/webm" });
    if (blob.size > 220000) { toast("صدا سنگین شد — کوتاه‌تر بگیر"); return; }
    var st = $("#r11RecT");
    if (st) st.textContent = "در حال فرستادن…";
    var fr = new FileReader();
    fr.onload = function () {
      api("POST", "/api/class/voice", { sessionId: SID(), data: String(fr.result), secs: secs })
        .then(function () {
          toast("صدای تو برای کلاس فرستاده شد ✅");
          if (st) st.textContent = "";
          refresh(true);
        })
        .catch(function (e) {
          if (st) st.textContent = "";
          toast((e && e.message) || "فرستادن صدا ممکن نشد");
        });
    };
    fr.readAsDataURL(blob);
  }

  function paintRecBtn(on) {
    var b = $("#r11RecBtn");
    if (!b) return;
    b.classList.toggle("is-rec", !!on);
    b.innerHTML = on ? "⏹ پایان ضبط" : "🎤 پیام صوتی";
  }

  /* ══════════════════════════════ ۲. اتاق صدای زنده ══════════════════════════════ */
  var pcMap = {}, myStream = null, liveT = 0, muted = false, inLive = false, audioSink = null, polling = 0;

  function iceServers() {
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    };
  }

  function ensureSink() {
    if (audioSink) return audioSink;
    audioSink = D.createElement("div");
    audioSink.id = "r11Sink";
    audioSink.style.display = "none";
    D.body.appendChild(audioSink);
    return audioSink;
  }

  function send(peer, kind, payload) {
    return api("POST", "/api/class/rtc", {
      sessionId: SID(), peer: PID, action: "send", to: peer, kind: kind, payload: payload
    }).catch(function () { });
  }

  function makePeer(other, initiator) {
    if (pcMap[other]) return pcMap[other];
    var pc = new W.RTCPeerConnection(iceServers());
    pcMap[other] = pc;
    try { if (myStream) myStream.getTracks().forEach(function (t) { pc.addTrack(t, myStream); }); } catch (e) { }
    pc.onicecandidate = function (ev) {
      if (ev.candidate) send(other, "ice", ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate);
    };
    pc.ontrack = function (ev) {
      var sink = ensureSink();
      var el = D.getElementById("r11a_" + other);
      if (!el) { el = D.createElement("audio"); el.id = "r11a_" + other; el.autoplay = true; sink.appendChild(el); }
      try { el.srcObject = ev.streams[0]; el.play().catch(function () { }); } catch (e) { }
      paintPeers();
    };
    pc.onconnectionstatechange = function () { paintPeers(); };
    if (initiator) {
      pc.onnegotiationneeded = function () {
        pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
          .then(function () { send(other, "offer", pc.localDescription); })
          .catch(function () { });
      };
    }
    return pc;
  }

  function dropPeer(other) {
    try { var pc = pcMap[other]; if (pc) pc.close(); } catch (e) { }
    delete pcMap[other];
    var el = D.getElementById("r11a_" + other);
    if (el) el.remove();
  }

  function onInbox(items) {
    items.forEach(function (m) {
      if (!m || !m.from) return;
      var other = m.from;
      if (m.kind === "offer") {
        var pc = makePeer(other, false);
        pc.setRemoteDescription(new W.RTCSessionDescription(m.payload))
          .then(function () { return pc.createAnswer(); })
          .then(function (a) { return pc.setLocalDescription(a); })
          .then(function () { send(other, "answer", pc.localDescription); })
          .catch(function () { });
      } else if (m.kind === "answer") {
        var pc2 = pcMap[other];
        if (pc2 && !pc2.currentRemoteDescription) pc2.setRemoteDescription(new W.RTCSessionDescription(m.payload)).catch(function () { });
      } else if (m.kind === "ice") {
        var pc3 = pcMap[other] || makePeer(other, false);
        try { pc3.addIceCandidate(new W.RTCIceCandidate(m.payload)).catch(function () { }); } catch (e) { }
      } else if (m.kind === "bye") {
        dropPeer(other);
      }
    });
  }

  function pollRtc() {
    if (!inLive) return;
    api("POST", "/api/class/rtc", { sessionId: SID(), peer: PID, action: "poll", muted: muted })
      .then(function (r) {
        if (!r) return;
        onInbox(r.inbox || []);
        var peers = (r.peers || []).filter(function (p) { return p.id !== PID; });
        // چه کسی تماس را شروع کند؟ آن‌که شناسهٔ کوچک‌تری دارد (بدون تداخل)
        peers.forEach(function (p) {
          if (!pcMap[p.id] && PID < p.id) makePeer(p.id, true);
          if (!pcMap[p.id] && PID > p.id) makePeer(p.id, false);
        });
        Object.keys(pcMap).forEach(function (k) {
          if (!peers.filter(function (p) { return p.id === k; }).length) dropPeer(k);
        });
        paintPeers(peers);
      })
      .catch(function () { });
  }

  function joinLive() {
    if (!W.RTCPeerConnection) { toast("مرورگر تو تماس زنده را پشتیبانی نمی‌کند"); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast("میکروفون در دسترس نیست"); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
      myStream = st;
      inLive = true; muted = false;
      api("POST", "/api/class/rtc", { sessionId: SID(), peer: PID, action: "join" }).then(function () {
        paintLive();
        if (polling) clearInterval(polling);
        polling = setInterval(pollRtc, 1800);
        pollRtc();
        toast("به اتاق صدا وصل شدی 🎧 حالا می‌توانی حرف بزنی");
      });
    }).catch(function () {
      toast("دسترسی به میکروفون داده نشد — اجازه بده و دوباره تلاش کن");
    });
  }

  function leaveLive() {
    inLive = false;
    if (polling) { clearInterval(polling); polling = 0; }
    Object.keys(pcMap).forEach(function (k) { send(k, "bye", null); dropPeer(k); });
    try { if (myStream) myStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { }
    myStream = null;
    api("POST", "/api/class/rtc", { sessionId: SID(), peer: PID, action: "leave" }).catch(function () { });
    paintLive();
    toast("از اتاق صدا بیرون آمدی");
  }

  function toggleMute() {
    muted = !muted;
    try { if (myStream) myStream.getAudioTracks().forEach(function (t) { t.enabled = !muted; }); } catch (e) { }
    api("POST", "/api/class/rtc", { sessionId: SID(), peer: PID, action: "state", muted: muted }).catch(function () { });
    paintLive();
    paintPeers();
  }

  /* ══════════════════════════════ ۳. ظاهر ══════════════════════════════ */
  function paintLive() {
    var b = $("#r11LiveBtn");
    if (b) {
      b.classList.toggle("is-on", inLive);
      b.innerHTML = inLive ? "📞 در تماس — خروج" : "📞 تماس صوتی زنده";
    }
    var p = $("#r11LivePanel");
    if (p) p.hidden = !inLive;
    var mb = $("#r11MuteBtn");
    if (mb) { mb.hidden = !inLive; mb.innerHTML = muted ? "🔊 باز کردن صدا" : "🔇 بی‌صدا"; }
    if (inLive) paintPeers();
  }

  function paintPeers(list) {
    var box = $("#r11Peers");
    if (!box) return;
    var peers = list || [];
    if (!inLive) { box.innerHTML = ""; return; }
    var mine = '<span class="r11-chip is-me">' + esc((ME() && ME().name) || "من") +
      " (تو" + (muted ? " · بی‌صدا" : "") + ")</span>";
    box.innerHTML = mine + peers.map(function (p) {
      var pc = pcMap[p.id];
      var st = pc ? (pc.connectionState || "new") : "connecting";
      var txt = st === "connected" ? "وصل" : st === "connecting" || st === "new" ? "در حال اتصال" : st;
      return '<span class="r11-chip">' + esc(p.name || "کاربر") +
        (p.muted ? " 🔇" : "") + " · " + esc(txt) + "</span>";
    }).join("");
  }

  function voiceBubble(v, mine) {
    return '<div class="hk-msg' + (mine ? " from-me" : "") + '"><div><div class="hk-msg-body">' +
      (!mine ? '<b style="font-size:.72rem;opacity:.8;display:block">' + esc(v.from) + "</b>" : "") +
      '<audio controls preload="none" src="' + v.data + '" style="max-width:210px;height:34px"></audio>' +
      '<div style="font-size:.68rem;opacity:.75;margin-top:2px">' + fa(v.secs) + " ثانیه" +
      ((v.canDel) ? ' · <button type="button" class="r11-del" data-vdel="' + esc(v.id) + '" style="background:none;border:0;color:inherit;cursor:pointer;text-decoration:underline">حذف</button>' : "") +
      "</div></div></div></div>";
  }

  /* ══════════════════════════════ ۴. تازه‌سازی و تزریق ══════════════════════════════ */
  var LASTV = 0;
  function refresh(force) {
    if (!SID()) return;
    api("GET", "/api/class/stream?session=" + encodeURIComponent(SID())).then(function (r) {
      if (!r || !r.room) return;
      var voices = r.room.voices || [];
      var host = $("#clsChat");
      if (!host) return;
      var me = ME();
      var have = {}, existing = 0;
      $all(".r11-voice", host).forEach(function (x) { have[x.getAttribute("data-v")] = x; existing++; });
      if (!voices.length) return;
      voices.forEach(function (v) {
        v.canDel = !!(me && (v.userId === me.id || me.isOwner || me.role === "owner" || me.role === "teacher"));
        if (have[v.id]) return;
        var d = D.createElement("div");
        d.className = "r11-voice";
        d.setAttribute("data-v", v.id);
        d.innerHTML = voiceBubble(v, me && v.userId === me.id);
        host.appendChild(d);
      });
      host.scrollTop = host.scrollHeight;
      if (force) toast("صداها تازه شد");
    }).catch(function () { });
  }

  function barHTML() {
    return '<div class="r11-bar" id="r11Bar">' +
      '<button type="button" class="r11-btn" id="r11RecBtn">🎤 پیام صوتی</button>' +
      '<span class="r11-status" id="r11RecT"></span>' +
      '<span style="flex:1"></span>' +
      '<button type="button" class="r11-btn" id="r11LiveBtn">📞 تماس صوتی زنده</button>' +
      '<button type="button" class="r11-btn" id="r11MuteBtn" hidden>🔇 بی‌صدا</button>' +
      "</div>" +
      /* پنل اتاق زنده — وقتی در تماس هستی باز می‌شود */
      '<div class="r11-live" id="r11LivePanel" hidden>' +
      '<div class="r11-live-h">🎧 در اتاق صدای کلاس هستی — صدای شما مستقیم بین مرورگرها می‌رود ' +
      "(از سرور عبور نمی‌کند). برای خروج، دکمهٔ «در تماس» را بزن.</div>" +
      '<div class="r11-peers" id="r11Peers"></div>' +
      "</div>";
  }

  function inject() {
    if (!SID()) return;
    if ($("#r11Bar")) return;
    var compose = $(".hk-chat-compose");
    if (!compose) return;
    compose.insertAdjacentHTML("afterend", barHTML());
    paintRecBtn(false);
    paintLive();
    wire();
    refresh(false);
  }

  function wire() {
    var b = $("#r11RecBtn");
    if (b) b.addEventListener("click", function () { if (rec) stopRec(); else startRec(); });
    var l = $("#r11LiveBtn");
    if (l) l.addEventListener("click", function () { if (inLive) leaveLive(); else joinLive(); });
    var m = $("#r11MuteBtn");
    if (m) m.addEventListener("click", toggleMute);
    var box = $("#r11Peers");
    if (box) box.addEventListener("click", function () { });
    D.addEventListener("click", function (e) {
      var d = e.target.closest && e.target.closest("[data-vdel]");
      if (!d) return;
      var id = d.getAttribute("data-vdel");
      api("POST", "/api/class/voiceDel", { sessionId: SID(), id: id }).then(function () {
        var el = document.querySelector('.r11-voice[data-v="' + id + '"]');
        if (el) el.remove();
        toast("صدا حذف شد");
      }).catch(function (err) { toast((err && err.message) || "حذف نشد"); });
    });
  }

  /* هر ۴ ثانیه صداهای تازه را بگیر (بدون رفرش) */
  function startLoop() {
    if (liveT) clearInterval(liveT);
    liveT = setInterval(function () {
      if (D.hidden) return;
      if (!SID()) return;
      refresh(false);
      if (inLive) { var mb = $("#r11MuteBtn"); if (mb) mb.hidden = false; }
    }, 4000);
  }

  function boot() {
    try {
      inject();
      startLoop();
      var ob = new MutationObserver(function () { try { inject(); } catch (e) { } });
      ob.observe(D.body, { childList: true, subtree: true });
      W.addEventListener("beforeunload", function () { if (inLive) leaveLive(); });
    } catch (e) { }
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();

  W.R11 = { refresh: refresh, join: joinLive, leave: leaveLive, state: function () { return { inLive: inLive, muted: muted, peers: Object.keys(pcMap) }; } };
})();
