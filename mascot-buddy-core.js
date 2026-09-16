/* Mascot Buddy — shared core, used site-wide.
   Reads the page's variant from <body data-mascot="...">, looks it up in
   window.MASCOT_VARIANTS (mascot-config.js, loaded first), builds the mascot DOM,
   and runs one of three modes:
     form      — full reactive state machine bound to the page's lead form
                 (idle | curious | confused | anxious | happy | excited | pleading | celebrating)
     static    — single pose + gentle sway + persistent speech bubble
     celebrate — plays the celebration on page load, then settles into happy idle
   If a variant's artwork folder isn't populated yet, falls back to the default
   character set so every page still shows the same bear. */
(function () {
  "use strict";

  var CFG = {
    DEBOUNCE_MS: 300,          // field-jump detection debounce
    JUMP_MIN_CHARS: 3,         // fewer chars than this on leave = "incomplete hop"
    JUMP_COUNT: 2,             // hops within window to trigger confused
    JUMP_WINDOW_MS: 4000,
    CONFUSED_HOLD_MS: 1800,
    CELEBRATE_HOLD_MS: 2000,
    CROSSFADE_MS: 320,
    PHONE_MIN_DIGITS: 10,
    NAME_MIN_CHARS: 2,
    OPTIONAL_MIN_CHARS: 2,     // optional text/textarea counts toward progress at this length
    TIER2_PCT: 34,
    TIER3_PCT: 67,
    DEFAULT_DIR: "assets/mascot/default/"
  };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var variants = window.MASCOT_VARIANTS || {};
  var variantName = document.body.getAttribute("data-mascot");
  var v = variantName && variants[variantName];
  if (!v) return;

  /* ---------- asset resolution: use variant art if present, else default set ---------- */
  function resolveAssets(cb) {
    if (v.dir === CFG.DEFAULT_DIR) { cb(v.dir, v.images); return; }
    var probe = new Image();
    probe.onload = function () { cb(v.dir, v.images); };
    probe.onerror = function () { cb(CFG.DEFAULT_DIR, v.fallbackImages || v.images); };
    probe.src = v.dir + v.images[v.probe || "idle"];
  }

  /* ---------- DOM ---------- */
  function buildDom(dir, images, firstState) {
    var host;
    if (v.placement === "form") {
      host = document.querySelector(v.target);
      if (!host) return null;
    } else {
      host = document.body;
    }

    var root = document.createElement("div");
    root.className = "mascot-buddy m-" + firstState +
      (v.placement === "corner" ? " mascot-corner" : "") +
      (reduceMotion ? " m-static" : "");
    root.setAttribute("aria-hidden", "true");

    var bubble = document.createElement("div");
    bubble.className = "mascot-bubble";
    bubble.textContent = v.bubbles[firstState] || v.defaultBubble;

    var fig = document.createElement("div");
    fig.className = "mascot-fig";

    /* two stacked images so state changes crossfade with no blank frame */
    var imgA = mkImg(dir + images[firstState], firstState);
    var imgB = mkImg(dir + images[firstState], firstState);
    imgB.className = "under";

    var emote = document.createElement("span");
    emote.className = "mascot-emote";

    fig.appendChild(imgB);
    fig.appendChild(imgA);
    fig.appendChild(emote);
    root.appendChild(bubble);
    root.appendChild(fig);
    host.appendChild(root);

    return { root: root, bubble: bubble, fig: fig, imgA: imgA, imgB: imgB, emote: emote, dir: dir, images: images };
  }

  function mkImg(src, state) {
    var img = new Image();
    img.src = src;
    img.alt = "";
    img.width = 110; img.height = 130;
    img.decoding = "async";
    img.setAttribute("fetchpriority", "low");
    img.setAttribute("data-state", state);
    return img;
  }

  resolveAssets(function (dir, images) {
    var firstState = v.mode === "static" ? "pose" : (v.mode === "celebrate" ? "celebrating" : "idle");
    var ui = buildDom(dir, images, firstState);
    if (!ui) return;

    /* preload every state after page settles so crossfades never flash */
    window.addEventListener("load", function () {
      Object.keys(images).forEach(function (k) {
        var pre = new Image();
        pre.src = dir + images[k];
      });
    });

    function setEmote(kind) {
      ui.emote.className = "mascot-emote" + (kind ? " show " + kind : "");
      ui.emote.textContent = kind === "q" ? "?" : "";
    }

    /* crossfade: new state loads on the under image, top image fades out over it */
    function swapImage(next) {
      if (ui.imgA.getAttribute("data-state") === next) return;
      if (reduceMotion) {
        ui.imgA.src = ui.dir + ui.images[next];
        ui.imgA.setAttribute("data-state", next);
        return;
      }
      ui.imgB.src = ui.dir + ui.images[next];
      ui.imgB.setAttribute("data-state", next);
      ui.imgA.style.opacity = "0";
      setTimeout(function () {
        ui.imgA.src = ui.dir + ui.images[next];
        ui.imgA.setAttribute("data-state", next);
        ui.imgA.style.opacity = "1";
      }, CFG.CROSSFADE_MS);
    }

    function burstLeaves() {
      var wrap = document.createElement("div");
      wrap.className = "mascot-burst";
      var glyphs = ["leaf", "leaf", "star"];
      for (var i = 0; i < 13; i++) {
        var p = document.createElement("i");
        p.className = "burst-p " + glyphs[i % glyphs.length];
        var ang = (Math.PI * 2 * i) / 13 + Math.random() * 0.5;
        var dist = 60 + Math.random() * 70;
        p.style.setProperty("--tx", Math.cos(ang) * dist + "px");
        p.style.setProperty("--ty", (Math.sin(ang) * dist - 40) + "px");
        p.style.setProperty("--rot", (Math.random() * 540 - 270) + "deg");
        p.style.animationDelay = (Math.random() * 120) + "ms";
        wrap.appendChild(p);
      }
      ui.fig.appendChild(wrap);
      setTimeout(function () { wrap.remove(); }, 1400);
    }

    /* ---------- static mode: one pose, sway, persistent bubble ---------- */
    if (v.mode === "static") {
      if (v.emote) setEmote(v.emote);
      return;
    }

    /* ---------- celebrate mode (thank-you page): party on load, settle to happy ---------- */
    if (v.mode === "celebrate") {
      if (v.emote) setEmote(v.emote);
      if (!reduceMotion) burstLeaves();
      setTimeout(function () {
        swapImage("happy");
        ui.root.className = "mascot-buddy m-idle" +
          (v.placement === "corner" ? " mascot-corner" : "") + (reduceMotion ? " m-static" : "");
      }, reduceMotion ? 0 : CFG.CELEBRATE_HOLD_MS);
      return;
    }

    /* ---------- form mode: full reactive state machine ---------- */
    var form = document.querySelector(v.target + " form[data-lead-form]");
    if (!form) return;

    /* watched fields: visible text/tel inputs, selects, textareas.
       name + tel have validity rules; selects need touching; other text is optional
       and counts toward progress once it has a little content. */
    var fields = [].slice.call(
      form.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], select, textarea')
    );
    var submitBtn = form.querySelector('button[type="submit"]');

    var state = "idle";
    var lockedUntil = 0;         // timestamp: don't let lower-priority states override
    var touched = {};            // select elements the user has interacted with
    var hops = [];               // timestamps of incomplete field hops
    var lastFocused = null;
    var debounceTimer = null;

    function fieldValid(f) {
      if (f.tagName === "SELECT") return !!touched[f.name];
      if (f.type === "tel") return f.value.replace(/\D/g, "").length >= CFG.PHONE_MIN_DIGITS;
      if (f.type === "email") return f.value.indexOf("@") > 0 && f.value.indexOf(".", f.value.indexOf("@")) > 0;
      if (f.name === "name") return f.value.trim().length >= CFG.NAME_MIN_CHARS;
      return f.value.trim().length >= CFG.OPTIONAL_MIN_CHARS;
    }
    function validCount() {
      var n = 0;
      fields.forEach(function (f) { if (fieldValid(f)) n++; });
      return n;
    }
    function pct() { return Math.round(100 * validCount() / fields.length); }
    /* complete = every required field valid, plus any select touched
       (optional address/details fields don't gate the excited/pleading states) */
    function isComplete() {
      return fields.every(function (f) {
        if (f.tagName === "SELECT" || f.required) return fieldValid(f);
        return true;
      });
    }

    function setState(next, opts) {
      opts = opts || {};
      var now = Date.now();
      if (now < lockedUntil && !opts.force) return;
      if (opts.lockMs) lockedUntil = now + opts.lockMs;
      if (state === next && !opts.refresh) return;
      state = next;

      swapImage(next);
      ui.root.className = "mascot-buddy m-" + next + (reduceMotion ? " m-static" : "");
      ui.bubble.textContent = v.bubbles[next] || v.defaultBubble;
      setEmote(next === "confused" ? "q" : (next === "anxious" || next === "pleading") ? "drop" : "");

      if (!reduceMotion) {
        if (next === "celebrating") burstLeaves();
        ui.fig.style.transform = "";
      }
    }

    /* lean toward the focused field: tilt grows with field index */
    function leanAt(fieldIdx) {
      if (reduceMotion) return;
      var rot = -4 - fieldIdx * 3;
      var dx = -4 - fieldIdx * 4;
      ui.fig.style.transform = "rotate(" + rot + "deg) translateX(" + dx + "px)";
    }

    function bounce() {
      if (reduceMotion) return;
      ui.fig.classList.remove("m-bounce");
      void ui.fig.offsetWidth; /* restart animation */
      ui.fig.classList.add("m-bounce");
    }

    function stateForProgress() {
      var p = pct();
      if (p >= CFG.TIER3_PCT) return "happy";
      if (p >= CFG.TIER2_PCT) return "curious";
      /* stay engaged while the user is actively in a field */
      var active = document.activeElement;
      return fields.indexOf(active) !== -1 ? "curious" : "idle";
    }

    /* ---- field events ---- */
    fields.forEach(function (f, idx) {
      f.addEventListener("focus", function () {
        /* incomplete-hop detection (debounced) */
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          if (lastFocused && lastFocused !== f) {
            var lf = lastFocused;
            var short = lf.tagName === "INPUT" && lf.value.trim().length > 0 &&
                        lf.value.trim().length < CFG.JUMP_MIN_CHARS;
            if (short) {
              var now = Date.now();
              hops = hops.filter(function (t) { return now - t < CFG.JUMP_WINDOW_MS; });
              hops.push(now);
              if (hops.length >= CFG.JUMP_COUNT) {
                hops = [];
                setState("confused", { lockMs: CFG.CONFUSED_HOLD_MS });
                setTimeout(function () { setState(stateForProgress(), { force: true }); }, CFG.CONFUSED_HOLD_MS);
                return;
              }
            }
          }
          lastFocused = f;
          setState("curious");
          leanAt(idx);
        }, CFG.DEBOUNCE_MS);
      });

      f.addEventListener("blur", function () {
        var invalid =
          (f.name === "name" && f.value.trim().length > 0 && f.value.trim().length < CFG.NAME_MIN_CHARS) ||
          (f.type === "tel" && f.value.trim().length > 0 && f.value.replace(/\D/g, "").length < CFG.PHONE_MIN_DIGITS);
        if (invalid) {
          setState("anxious", { lockMs: 1200 });
          setTimeout(function () { setState(stateForProgress(), { force: true }); }, 1400);
        } else {
          setState(stateForProgress());
        }
        if (!reduceMotion) ui.fig.style.transform = "";
      });

      var prevValid = false;
      f.addEventListener("input", function () {
        if (f.tagName === "SELECT") touched[f.name] = true;
        var nowValid = fieldValid(f);
        if (nowValid && !prevValid) bounce();
        prevValid = nowValid;
        setState(stateForProgress());
        if (document.activeElement === f) leanAt(idx);
      });
      if (f.tagName === "SELECT") f.addEventListener("change", function () { touched[f.name] = true; bounce(); setState(stateForProgress()); });
    });

    /* ---- submit button proximity ---- */
    if (submitBtn) {
      submitBtn.addEventListener("mouseenter", function () {
        setState(isComplete() ? "excited" : "curious");
        if (isComplete()) bounce();
      });
      submitBtn.addEventListener("mouseleave", function () {
        if (isComplete() && state !== "celebrating") setState("pleading", { lockMs: 1500 });
        setTimeout(function () { if (state === "pleading") setState(stateForProgress(), { force: true }); }, 2200);
      });
    }

    /* ---- submit: quick celebration while lead-forms.js sends + redirects to /thank-you.html ---- */
    form.addEventListener("submit", function () {
      setState("celebrating", { force: true, lockMs: CFG.CELEBRATE_HOLD_MS });
    });

    setState("idle", { refresh: true });
  });
})();
