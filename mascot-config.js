/* Mascot Buddy — per-page variant definitions.
   Pages opt in via <body data-mascot="variantName">; mascot-buddy-core.js does the rest.

   Modes:
     form      — reactive to the page's lead form (needs the full 6-image state set)
     static    — one pose + sway + persistent bubble (needs 1 image: pose.webp)
     celebrate — celebration on page load, settles to happy idle

   ART STATUS: each variant's `dir` is probed at runtime. Until X drops the variant
   artwork into that folder, the core falls back to assets/mascot/default/ using
   the fallbackImages mapping — same bear, no costume, page still works. Drop the
   files listed in assets/mascot/README.md into the variant folder and the costume
   goes live with zero code changes. */
window.MASCOT_VARIANTS = {

  /* Home — the original Form Buddy, unchanged behavior */
  "default": {
    mode: "form",
    placement: "form",
    target: ".hero-card",
    dir: "assets/mascot/default/",
    images: {
      idle: "idle.webp", curious: "curious.webp", confused: "confused.webp",
      anxious: "anxious.webp", happy: "happy.webp", excited: "happy.webp",
      pleading: "anxious.webp", celebrating: "celebrating.webp"
    },
    defaultBubble: "Let's get started!",
    bubbles: {
      idle: "Let's get started!",
      curious: "Ooh, tell me more!",
      confused: "Wait — where'd we go?",
      anxious: "That field needs a little love.",
      happy: "Almost there!",
      excited: "YES! Right there!",
      pleading: "Don't leave me hanging!",
      celebrating: "Woohoo — sent it!"
    }
  },

  /* Storm Emergency — raincoat costume. Two poses exist (idle + happy, cut from
     X's Gemini art 2026-07-03); every state maps onto them, and the CSS motion
     (shake/hop/lean) still differentiates the reactions. If X later generates the
     remaining raincoat poses (curious/confused/anxious/celebrating), point these
     entries at the new files. */
  "storm": {
    mode: "form",
    placement: "form",
    target: ".quote-form",
    dir: "assets/mascot/storm/",
    probe: "idle",
    images: {
      idle: "idle.webp", curious: "idle.webp", confused: "idle.webp",
      anxious: "idle.webp", happy: "happy.webp", excited: "happy.webp",
      pleading: "idle.webp", celebrating: "happy.webp"
    },
    fallbackImages: {
      idle: "idle.webp", curious: "curious.webp", confused: "confused.webp",
      anxious: "anxious.webp", happy: "happy.webp", excited: "happy.webp",
      pleading: "anxious.webp", celebrating: "celebrating.webp"
    },
    defaultBubble: "Storm damage? We're on it fast.",
    bubbles: {
      idle: "Storm damage? We're on it fast.",
      curious: "Tell me what happened.",
      confused: "Wait — where'd we go?",
      anxious: "That field needs a little love.",
      happy: "Help is almost on the way!",
      excited: "Send it — we're ready!",
      pleading: "Don't leave me hanging!",
      celebrating: "Got it — hang tight!"
    }
  },

  /* FAQ — thoughtful sitting pose, reading glasses, floating question mark.
     AWAITING ART: assets/mascot/faq/pose.webp */
  "faq": {
    mode: "static",
    placement: "corner",
    dir: "assets/mascot/faq/",
    probe: "pose",
    images: { pose: "pose.webp" },
    fallbackImages: { pose: "curious.webp" },
    emote: "q",
    defaultBubble: "Got questions? I've got answers.",
    bubbles: {}
  },

  /* Thank-you page — auto-celebration on load, settles into happy idle.
     Works today with default art; assets/mascot/thankyou/ (celebrating.webp +
     happy.webp with checkmark badge / big grin) upgrades it. */
  "thankyou": {
    mode: "celebrate",
    placement: "corner",
    dir: "assets/mascot/thankyou/",
    probe: "celebrating",
    images: { celebrating: "celebrating.webp", happy: "happy.webp" },
    fallbackImages: { celebrating: "celebrating.webp", happy: "happy.webp" },
    emote: "check",
    defaultBubble: "Thanks! We'll be in touch soon.",
    bubbles: {}
  },

  /* Service Areas — waving / pointing-at-map-pin pose.
     AWAITING ART: assets/mascot/service-areas/pose.webp */
  "service-areas": {
    mode: "static",
    placement: "corner",
    dir: "assets/mascot/service-areas/",
    probe: "pose",
    images: { pose: "pose.webp" },
    fallbackImages: { pose: "happy.webp" },
    defaultBubble: "Serving Jacksonville and all of Onslow County!",
    bubbles: {}
  },

  /* Contact page — same bear as home, reactive on the full quote form */
  "contact": {
    mode: "form",
    placement: "form",
    target: ".quote-form",
    dir: "assets/mascot/default/",
    images: {
      idle: "idle.webp", curious: "curious.webp", confused: "confused.webp",
      anxious: "anxious.webp", happy: "happy.webp", excited: "happy.webp",
      pleading: "anxious.webp", celebrating: "celebrating.webp"
    },
    defaultBubble: "Let's get you that quote!",
    bubbles: {
      idle: "Let's get you that quote!",
      curious: "Ooh, tell me more!",
      confused: "Wait — where'd we go?",
      anxious: "That field needs a little love.",
      happy: "Almost there!",
      excited: "YES! Right there!",
      pleading: "Don't leave me hanging!",
      celebrating: "Woohoo — sent it!"
    }
  },

  /* Tree Removal service page — chainsaw-on-shoulder confident pose, but the page
     has a live quote form, so the reactive state machine runs; every state shows
     the chainsaw pose until a full costume set exists.
     AWAITING ART: assets/mascot/tree-removal/pose.webp (minimum) */
  "tree-removal": {
    mode: "form",
    placement: "form",
    target: ".quote-form",
    dir: "assets/mascot/tree-removal/",
    probe: "idle",
    images: {
      idle: "pose.webp", curious: "pose.webp", confused: "pose.webp",
      anxious: "pose.webp", happy: "pose.webp", excited: "pose.webp",
      pleading: "pose.webp", celebrating: "pose.webp"
    },
    fallbackImages: {
      idle: "idle.webp", curious: "curious.webp", confused: "confused.webp",
      anxious: "anxious.webp", happy: "happy.webp", excited: "happy.webp",
      pleading: "anxious.webp", celebrating: "celebrating.webp"
    },
    defaultBubble: "Full removals, done right.",
    bubbles: {
      idle: "Full removals, done right.",
      curious: "Ooh, tell me about the job!",
      confused: "Wait — where'd we go?",
      anxious: "That field needs a little love.",
      happy: "Almost there!",
      excited: "YES! Right there!",
      pleading: "Don't leave me hanging!",
      celebrating: "Woohoo — sent it!"
    }
  }
};
