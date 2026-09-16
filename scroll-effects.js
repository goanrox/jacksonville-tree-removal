(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Header shrink-on-scroll ---------- */
  var header = document.querySelector("header.site");
  if (header) {
    var onHeaderScroll = function () {
      if (window.scrollY > 12) header.classList.add("is-scrolled");
      else header.classList.remove("is-scrolled");
    };
    window.addEventListener("scroll", onHeaderScroll, { passive: true });
    onHeaderScroll();

    var nav = header.querySelector("nav.site-nav");
    if (nav) {
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "menu-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation menu");
      toggle.innerHTML = '<span class="menu-icon" aria-hidden="true"></span>';
      nav.id = nav.id || "site-navigation";
      toggle.setAttribute("aria-controls", nav.id);
      nav.parentNode.insertBefore(toggle, nav);

      function closeMenu() {
        header.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation menu");
      }
      toggle.addEventListener("click", function () {
        var open = header.classList.toggle("menu-open");
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
      });
      nav.addEventListener("click", function (event) {
        if (event.target.closest("a")) closeMenu();
      });
      window.addEventListener("resize", function () {
        if (window.innerWidth > 860) closeMenu();
      });
    }
  }

  /* ---------- 3D parallax hero scene ---------- */
  if (reduceMotion) return;

  var scene = document.querySelector(".hero-scene, .hero-photo");
  if (!scene) return;

  var layers = scene.querySelectorAll("[data-depth]");
  var ticking = false;

  function update() {
    var rect = scene.getBoundingClientRect();
    var scrollOffset = window.scrollY;

    layers.forEach(function (layer) {
      var depth = parseFloat(layer.getAttribute("data-depth"));
      var move = scrollOffset * depth * 0.18;
      layer.style.transform = "translate3d(0, " + move + "px, 0)";
    });

    var progress = Math.min(Math.max(-rect.top / 600, 0), 1);
    scene.style.transform = "perspective(1400px) rotateX(" + (progress * 3) + "deg) scale(" + (1 + progress * 0.02) + ")";

    ticking = false;
  }

  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true }
  );

  update();
})();
