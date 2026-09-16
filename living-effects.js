(function () {
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Mouse-shift branch layers ---------- */
  var hero = document.querySelector(".hero");
  var mouseLayers = document.querySelectorAll("[data-mouse]");
  if (hero && mouseLayers.length && !reduceMotion) {
    var mx = 0, my = 0, mTick = false;
    var applyMouse = function () {
      mouseLayers.forEach(function (el) {
        var s = parseFloat(el.getAttribute("data-mouse"));
        el.style.transform = "translate3d(" + (-mx * s) + "px," + (-my * s) + "px,0)";
      });
      mTick = false;
    };
    hero.addEventListener("mousemove", function (e) {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      if (!mTick) { requestAnimationFrame(applyMouse); mTick = true; }
    });
  }

  /* ---------- Global parallax (treeline dividers) ---------- */
  var pLayers = document.querySelectorAll("[data-parallax-speed]");
  if (pLayers.length && !reduceMotion) {
    var pTick = false;
    var applyParallax = function () {
      var vh = window.innerHeight;
      pLayers.forEach(function (el) {
        var r = el.parentElement.getBoundingClientRect();
        var offset = (r.top + r.height / 2 - vh / 2) * parseFloat(el.getAttribute("data-parallax-speed"));
        el.style.transform = "translate3d(0," + offset + "px,0)";
      });
      pTick = false;
    };
    window.addEventListener("scroll", function () {
      if (!pTick) { requestAnimationFrame(applyParallax); pTick = true; }
    }, { passive: true });
    applyParallax();
  }

  /* ---------- Staggered spring pop-ins ---------- */
  var seqGroups = document.querySelectorAll("[data-pop-seq]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var seqIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var kids = entry.target.children;
        for (var i = 0; i < kids.length; i++) {
          kids[i].style.transitionDelay = (i * 90) + "ms";
          kids[i].classList.add("is-sprung");
        }
        seqIO.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    seqGroups.forEach(function (g) { seqIO.observe(g); });
  } else {
    seqGroups.forEach(function (g) {
      for (var i = 0; i < g.children.length; i++) g.children[i].classList.add("is-sprung");
    });
  }

  /* ---------- Count-up stats ---------- */
  var counters = document.querySelectorAll("[data-count-to]");
  function runCount(el) {
    var target = parseInt(el.getAttribute("data-count-to"), 10);
    var start = null, dur = 1200;
    function frame(ts) {
      if (!start) start = ts;
      var t = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  if (counters.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      counters.forEach(function (el) { el.textContent = el.getAttribute("data-count-to"); });
    } else {
      var cIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { runCount(entry.target); cIO.unobserve(entry.target); }
        });
      }, { threshold: 0.6 });
      counters.forEach(function (el) { cIO.observe(el); });
    }
  }
})();
