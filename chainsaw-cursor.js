(function () {
  "use strict";

  if (!window.matchMedia("(pointer: fine)").matches) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.body.classList.add("chainsaw-cursor-active");

  var cursor = document.createElement("div");
  cursor.id = "chainsaw-cursor";
  cursor.setAttribute("aria-hidden", "true");
  var img = document.createElement("img");
  img.src = "chainsaw-cursor.png";
  img.alt = "";
  img.draggable = false;
  cursor.appendChild(img);
  document.body.appendChild(cursor);

  // Hotspot: fraction of the image where the blade tip sits, so the
  // "business end" tracks close to the real pointer position. Must match
  // the #chainsaw-cursor width/height set in styles.css.
  var CURSOR_W = 96;
  var CURSOR_H = 88;
  var HOTSPOT_X = 0.86 * CURSOR_W;
  var HOTSPOT_Y = 0.1 * CURSOR_H;

  var mouseX = -100, mouseY = -100;
  var curX = -100, curY = -100;
  var prevMouseX = -100;
  var tilt = 0;
  var punch = 0;
  var shown = false;
  var lastTime = null;

  document.addEventListener("mousemove", function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!shown) {
      shown = true;
      cursor.classList.add("visible");
    }
  });

  document.addEventListener("mouseleave", function () {
    cursor.classList.remove("visible");
    shown = false;
  });

  document.addEventListener(
    "mouseover",
    function (e) {
      var tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        cursor.classList.remove("visible");
      } else if (shown) {
        cursor.classList.add("visible");
      }
    },
    true
  );

  function loop(now) {
    if (lastTime === null) lastTime = now;
    var dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    var posT = 1 - Math.exp(-18 * dt);
    curX += (mouseX - curX) * posT;
    curY += (mouseY - curY) * posT;

    var vx = dt > 0 ? (mouseX - prevMouseX) / dt : 0;
    prevMouseX = mouseX;
    var targetTilt = Math.max(-10, Math.min(10, vx * 0.025));
    var tiltT = 1 - Math.exp(-10 * dt);
    tilt += (targetTilt - tilt) * tiltT;

    var punchT = 1 - Math.exp(-14 * dt);
    punch += (0 - punch) * punchT;

    var scale = 1 - punch * 0.14;
    var punchTilt = -punch * 8;

    cursor.style.transform =
      "translate(" + (curX - HOTSPOT_X) + "px, " + (curY - HOTSPOT_Y) + "px) rotate(" + (tilt + punchTilt).toFixed(2) + "deg) scale(" + scale.toFixed(3) + ")";

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function spawnChips(x, y) {
    var count = 9;
    for (var i = 0; i < count; i++) {
      var chip = document.createElement("div");
      chip.className = "wood-chip";
      var angle = Math.random() * Math.PI * 2;
      var dist = 30 + Math.random() * 55;
      var tx = Math.cos(angle) * dist;
      var ty = Math.sin(angle) * dist - 18;
      chip.style.setProperty("--tx", tx.toFixed(0) + "px");
      chip.style.setProperty("--ty", ty.toFixed(0) + "px");
      chip.style.setProperty("--rot", (Math.random() * 360 - 180).toFixed(0) + "deg");
      chip.style.left = x + "px";
      chip.style.top = y + "px";
      document.body.appendChild(chip);
      chip.addEventListener("animationend", function () {
        this.remove();
      });
    }
  }

  document.addEventListener("mousedown", function (e) {
    punch = 1;
    if (!reduceMotion) spawnChips(e.clientX, e.clientY);
  });
})();
