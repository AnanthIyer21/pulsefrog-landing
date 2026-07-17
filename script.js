/* PulseFrog landing — the Pulse, demo player, waitlist.
   No dependencies. Spec §4 allows simulated amplitude smoothing at this scale,
   so the waveform is procedurally animated (no Web Audio graph needed). */

(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- the Pulse (§4): ~24 bars, breathing ---------- */

  function PulseWave(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.density = (opts && opts.density) || 0; // px per bar; 0 = fixed count
    this.bars = (opts && opts.bars) || 24;
    this.mode = "idle";        // idle | playing | paused
    this.levels = [];          // smoothed per-bar levels 0..1
    this.targets = [];
    this.t = Math.random() * 100;
    this.raf = null;
    for (var i = 0; i < this.bars; i++) { this.levels[i] = 0.3; this.targets[i] = 0.3; }
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    window.addEventListener("resize", this.resize);
    this.resize();
    this.start();
  }

  PulseWave.prototype.color = function () {
    return getComputedStyle(document.documentElement).getPropertyValue("--pulse").trim() || "#7ED957";
  };

  PulseWave.prototype.resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    if (this.density) {
      var n = Math.max(24, Math.round(rect.width / this.density));
      if (n !== this.bars) {
        this.bars = n;
        this.levels = []; this.targets = [];
        for (var i = 0; i < n; i++) { this.levels[i] = 0.3; this.targets[i] = 0.3; }
      }
    }
    this.draw();
  };

  // idle: slow calm breathing — layered sines per bar
  PulseWave.prototype.idleLevel = function (i) {
    var n = this.bars;
    var center = 1 - Math.abs(i - (n - 1) / 2) / (n / 2); // taller mid, frog-eye-ish hump
    var envelope = 0.25 + 0.75 * Math.pow(center, 1.4);
    var breathe = 0.5 + 0.5 * Math.sin(this.t * 0.9 + i * 0.35);
    var drift = 0.5 + 0.5 * Math.sin(this.t * 0.37 + i * 0.9);
    var ripple = 0.5 + 0.5 * Math.sin(this.t * 1.7 - i * 0.22);
    return 0.06 + 0.74 * envelope * (0.18 + 0.42 * breathe + 0.2 * drift + 0.2 * ripple);
  };

  // playing: livelier response — faster movement + per-bar jitter
  PulseWave.prototype.playingLevel = function (i) {
    var wobble = 0.5 + 0.5 * Math.sin(this.t * 4.2 + i * 0.9)
               * Math.sin(this.t * 2.3 + i * 2.1);
    var jitter = Math.random() * 0.25;
    return 0.15 + 0.7 * wobble + jitter * 0.4;
  };

  PulseWave.prototype.step = function (dt) {
    this.t += dt;
    for (var i = 0; i < this.bars; i++) {
      this.targets[i] = this.mode === "playing" ? this.playingLevel(i) : this.idleLevel(i);
      var speed = this.mode === "playing" ? 10 : 2.5; // smoothing
      this.levels[i] += (this.targets[i] - this.levels[i]) * Math.min(1, speed * dt);
    }
  };

  PulseWave.prototype.draw = function () {
    var ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, n = this.bars;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.color();
    ctx.globalAlpha = this.mode === "paused" ? 0.4 : 1; // frozen mid-breath @40%
    var gap = w / n * 0.52;
    var bw = (w - gap * (n - 1)) / n;
    var r = Math.min(bw / 2, w * 0.006 + 2);
    for (var i = 0; i < n; i++) {
      var level = Math.max(0.06, Math.min(1, this.levels[i]));
      var bh = Math.max(bw, level * h * 0.92);
      var x = i * (bw + gap);
      var y = (h - bh) / 2;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, bw, bh, r);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, bw, bh);
      }
    }
    ctx.globalAlpha = 1;
  };

  PulseWave.prototype.frame = function (now) {
    if (!this.last) this.last = now;
    var dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  PulseWave.prototype.start = function () {
    if (reducedMotion.matches) {
      // reduced motion: a single, still frame — the Pulse rests
      this.step(0.016);
      this.draw();
      return;
    }
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  };

  PulseWave.prototype.stop = function () {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; this.last = null; }
  };

  PulseWave.prototype.setMode = function (mode) {
    this.mode = mode;
    if (reducedMotion.matches) this.draw(); // just restyle the still frame
  };

  var heroWave = new PulseWave(document.getElementById("hero-pulse"), { density: 16 });

  // keep the wave honest if the user flips reduced-motion or color scheme live
  reducedMotion.addEventListener && reducedMotion.addEventListener("change", function () {
    heroWave.stop();
    heroWave.start();
  });
  var scheme = window.matchMedia("(prefers-color-scheme: light)");
  scheme.addEventListener && scheme.addEventListener("change", function () {
    heroWave.draw();
  });

  /* ---------- waitlist (§5.1 · 4) ---------- */

  var form = document.getElementById("waitlist-form");
  var emailInput = document.getElementById("email");
  var submitBtn = form.querySelector("button[type=submit]");
  var status = document.getElementById("waitlist-status");
  var FALLBACK = "ananth@sffstudio.com";

  function setStatus(html, kind) {
    status.innerHTML = html;
    status.className = "waitlist-status" + (kind ? " " + kind : "");
  }

  function mailtoFallback(email) {
    var href = "mailto:" + FALLBACK +
      "?subject=" + encodeURIComponent("PulseFrog early access") +
      "&body=" + encodeURIComponent("Please add me to the waitlist: " + email);
    return 'The waitlist isn’t wired up yet — email us instead: <a href="' + href + '">' + FALLBACK + "</a>";
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  emailInput.addEventListener("input", function () {
    emailInput.removeAttribute("aria-invalid");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = emailInput.value.trim();

    if (!validEmail(email)) {
      emailInput.setAttribute("aria-invalid", "true");
      emailInput.focus();
      setStatus("Please enter a valid email address.", "err");
      return;
    }

    // endpoint still the placeholder? go straight to the mailto fallback
    if (form.action.indexOf("FORM_ID_TODO") !== -1) {
      setStatus(mailtoFallback(email), "err");
      return;
    }

    submitBtn.disabled = true;
    setStatus("Adding you…");

    var data = new FormData(form);
    fetch(form.action, {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" }
    }).then(function (res) {
      if (res.ok) {
        form.reset();
        setStatus("You’re on the list. We’ll be in touch.", "ok");
      } else {
        setStatus("Something went wrong. " + mailtoFallback(email), "err");
      }
    }).catch(function () {
      setStatus("Couldn’t reach the waitlist. " + mailtoFallback(email), "err");
    }).finally(function () {
      submitBtn.disabled = false;
    });
  });
})();
