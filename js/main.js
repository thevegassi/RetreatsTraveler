/* ============================================================
   RETREATS TRAVELER — motion engine (vanilla, no deps)
   One rAF loop · reflow-free scroll math · reduced-motion aware
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TOUCH  = matchMedia('(pointer: coarse)').matches;
  var clamp  = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp   = function (a, b, t) { return a + (b - a) * t; };

  /* ---------- mobile nav ---------- */
  var burger = document.querySelector('.burger');
  var nav = document.querySelector('.nav');
  if (burger && nav) {
    var setNav = function (open) {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('nav-open', open);
    };
    burger.addEventListener('click', function () { setNav(!nav.classList.contains('is-open')); });
    nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') setNav(false); });
  }

  /* ---------- eased in-page navigation (no jump between sections) ---------- */
  var hdrEl = document.querySelector('.hdr');
  var progScroll = false;
  /* header collapses to its stuck height once we start scrolling — target that, + a small breath */
  function anchorOffset() {
    if (!hdrEl) return 84;
    return (hdrEl.classList.contains('is-stuck') ? hdrEl.offsetHeight : hdrEl.offsetHeight - 16) + 14;
  }
  function easeInOutCubic(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function scrollToY(toY, cb) {
    toY = Math.max(0, Math.min(toY, document.documentElement.scrollHeight - innerHeight));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { window.scrollTo(0, toY); if (cb) cb(); return; }
    var fromY = window.scrollY || window.pageYOffset;
    var dist = toY - fromY;
    if (Math.abs(dist) < 2) { if (cb) cb(); return; }
    var dur = Math.min(1100, Math.max(480, Math.abs(dist) * 0.42));
    var t0 = performance.now();
    progScroll = true;
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, fromY + dist * easeInOutCubic(p));
      if (p < 1) requestAnimationFrame(step);
      else { progScroll = false; if (cb) cb(); }
    })(t0);
  }
  function goToHash(hash, push) {
    var el = hash && hash.length > 1 && document.getElementById(hash.slice(1));
    if (!el) return false;
    var y = el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset) - anchorOffset();
    scrollToY(y, function () {
      if (push !== false) { try { history.replaceState(null, '', hash); } catch (e) {} }
    });
    return true;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target === '_blank') return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) !== '#' || href.length < 2) return;
    if (!document.getElementById(href.slice(1))) return;
    e.preventDefault();
    if (nav && nav.classList.contains('is-open') && typeof setNav === 'function') setNav(false);
    goToHash(href);
  });
  /* deep-link on load: re-scroll with header offset */
  if (location.hash.length > 1) {
    window.addEventListener('load', function () { setTimeout(function () { goToHash(location.hash, false); }, 40); });
  }

  /* ---------- split [data-rv-text] into word spans ---------- */
  document.querySelectorAll('[data-rv-text]').forEach(function (el) {
    if (el.dataset.split) return;
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var outer = document.createElement('span'); outer.className = 'word';
      var inner = document.createElement('span');
      inner.textContent = w + (i < words.length - 1 ? ' ' : '');
      outer.appendChild(inner); el.appendChild(outer);
    });
    el.dataset.split = '1';
  });

  /* ---------- reveal on enter (IntersectionObserver) ---------- */
  var rvEls = [].slice.call(document.querySelectorAll('[data-rv],[data-rv-stagger],[data-rv-text]'));
  if ('IntersectionObserver' in window) {
    var rio = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -7% 0px' });
    rvEls.forEach(function (el) { rio.observe(el); });
    /* safety net: nothing stays hidden */
    setTimeout(function () { rvEls.forEach(function (el) { el.classList.add('is-in'); }); }, 4000);
  } else {
    rvEls.forEach(function (el) { el.classList.add('is-in'); });
  }
  var hero = document.querySelector('.hero');
  if (hero) hero.classList.add('is-in');

  /* ---------- hero video: fade in, pause offscreen, respect reduced-motion ---------- */
  var heroVid = document.querySelector('.scene__video');
  if (heroVid) {
    var vidReady = function () { heroVid.classList.add('is-ready'); };
    if (heroVid.readyState >= 2) vidReady();
    heroVid.addEventListener('loadeddata', vidReady);
    heroVid.addEventListener('error', function () { heroVid.hidden = true; });
    if (REDUCE) {
      heroVid.removeAttribute('autoplay');
      heroVid.addEventListener('loadeddata', function () { try { heroVid.pause(); } catch (e) {} });
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) { var p = heroVid.play(); if (p && p.catch) p.catch(function () {}); }
        else { try { heroVid.pause(); } catch (er) {} }
      }, { threshold: 0.05 }).observe(heroVid);
    }
  }

  /* ---------- scrollspy ---------- */
  if (nav) {
    var links = [].slice.call(nav.querySelectorAll('a')).filter(function (a) { return (a.getAttribute('href') || '')[0] === '#'; });
    var targets = links.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
    if ('IntersectionObserver' in window && targets.length) {
      var sio = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id); });
        });
      }, { rootMargin: '-46% 0px -50% 0px' });
      targets.forEach(function (t) { sio.observe(t); });
    }
  }

  /* ---------- destinations: infinite carousel ---------- */
  var railView  = document.querySelector('.rail__view');
  var railTrack = document.querySelector('.rail__track');
  var CAR = null;
  if (railView && railTrack) {
    var rPrev = document.querySelector('.rail__ctrl [data-rail="prev"]');
    var rNext = document.querySelector('.rail__ctrl [data-rail="next"]');

    if (REDUCE) {
      /* reduced motion → a plain, honest horizontal scroll */
      railView.classList.add('rail__view--native');
      var nStep = function () { var c = railTrack.querySelector('.dcard'); return (c ? c.offsetWidth : 340) + 18; };
      if (rPrev) rPrev.addEventListener('click', function () { railView.scrollBy({ left: -nStep(), behavior: 'smooth' }); });
      if (rNext) rNext.addEventListener('click', function () { railView.scrollBy({ left: nStep(), behavior: 'smooth' }); });
    } else {
      /* duplicate the set once so the loop is seamless */
      [].slice.call(railTrack.children).forEach(function (c) {
        var clone = c.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.tabIndex = -1;
        railTrack.appendChild(clone);
      });

      CAR = {
        track: railTrack, x: 0, target: 0, set: 0, step: 360,
        auto: true, drag: false, sx: 0, sox: 0, moved: 0, resume: 0, vis: true
      };
      CAR.measure = function () {
        var kids = railTrack.children, n = kids.length / 2, w = 0;
        for (var i = 0; i < n; i++) w += kids[i].offsetWidth + 18;
        CAR.set = w;
        CAR.step = kids[0] ? kids[0].offsetWidth + 18 : 360;
      };
      CAR.measure();
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (e) { CAR.vis = e[0].isIntersecting; }, { rootMargin: '20% 0px' }).observe(railView);
      }

      railView.addEventListener('pointerenter', function () { CAR.auto = false; });
      railView.addEventListener('pointerleave', function () { if (!CAR.drag) CAR.resume = performance.now() + 400; });

      railView.addEventListener('pointerdown', function (e) {
        CAR.drag = true; CAR.auto = false; CAR.sx = e.clientX; CAR.sox = CAR.x; CAR.moved = 0;
        railView.classList.add('is-drag');
        try { railView.setPointerCapture(e.pointerId); } catch (_) {}
      });
      window.addEventListener('pointermove', function (e) {
        if (!CAR.drag) return;
        var d = e.clientX - CAR.sx; CAR.moved = Math.abs(d);
        CAR.x = CAR.target = CAR.sox + d;
      });
      window.addEventListener('pointerup', function () {
        if (!CAR.drag) return;
        CAR.drag = false; railView.classList.remove('is-drag');
        CAR.resume = performance.now() + 900;
      });
      railTrack.addEventListener('click', function (e) { if (CAR.moved > 6) e.preventDefault(); }, true);

      var nudge = function (dir) { CAR.target += dir * CAR.step; CAR.auto = false; CAR.resume = performance.now() + 1400; };
      if (rPrev) rPrev.addEventListener('click', function () { nudge(1); });
      if (rNext) rNext.addEventListener('click', function () { nudge(-1); });
    }
  }

  /* ---------- bespoke forms ---------- */
  document.querySelectorAll('form[data-mock]').forEach(function (form) {
    form.querySelectorAll('.f input, .f textarea').forEach(function (inp) {
      var f = inp.closest('.f');
      var sync = function () { f.classList.toggle('has-val', !!inp.value.trim()); };
      inp.addEventListener('input', function () { sync(); f.classList.remove('is-bad'); });
      inp.addEventListener('blur', sync); sync();
    });
    var done = form.querySelector('.form__done');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = [].slice.call(form.querySelectorAll('[required]')).filter(function (el) {
        return el.type === 'checkbox' ? !el.checked : !String(el.value).trim();
      });
      if (bad.length) { var f = bad[0].closest('.f'); if (f) f.classList.add('is-bad'); bad[0].focus(); return; }
      if (done) done.hidden = false;
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.style.opacity = '.5'; }
      if (done) done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ========================================================
     MOTION ENGINE — one loop, geometry cached, no per-frame reflow
     ======================================================== */
  var hdr = document.querySelector('.hdr');
  var heroIn = document.querySelector('.hero__in');
  var heroRidges = hero ? [].slice.call(hero.querySelectorAll('.scene__ridge path')) : [];
  var pxEls = [].slice.call(document.querySelectorAll('[data-parallax]'));
  var featScene = document.querySelector('.feat__frame .ph') || document.querySelector('.feat__frame .scene');
  var bands = [].slice.call(document.querySelectorAll('.band')).map(function (b) {
    return { el: b, inner: b.querySelector('.band__in'), scene: b.querySelector('.scene'), top: 0, h: 0 };
  });
  var pipe = document.querySelector('.pipe');
  var pipeDivs = pipe ? [].slice.call(pipe.children) : [];
  var journey = document.querySelector('.journey');
  var jDraw = journey && journey.querySelector('.journey__route .draw');
  var jNodes = journey ? [].slice.call(journey.querySelectorAll('.journey__route .node')) : [];
  var jSteps = journey ? [].slice.call(journey.querySelectorAll('.jstep')) : [];
  var jLen = 0;
  if (jDraw) { try { jLen = jDraw.getTotalLength(); jDraw.style.strokeDasharray = jLen; jDraw.style.strokeDashoffset = jLen; } catch (e) {} }

  /* geometry cache (absolute offsets) */
  var G = { vh: innerHeight, doc: 0, hero: 0, feat: null, pipe: null, journey: null, px: [] };
  function offTop(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; }
  function measure() {
    G.vh = innerHeight;
    G.doc = document.documentElement.scrollHeight - G.vh;
    G.hero = hero ? hero.offsetHeight : 0;
    var mob = innerWidth < 760;
    G.mob = mob;
    if (CAR && CAR.measure) CAR.measure();
    if (featScene) { var f = featScene.closest('.feat__frame'); G.feat = { top: offTop(f), h: f.offsetHeight }; }
    if (pipe) G.pipe = { top: offTop(pipe), h: pipe.offsetHeight };
    if (journey) G.journey = { top: offTop(journey), h: journey.offsetHeight };
    G.px = pxEls.map(function (el) { return { el: el, top: offTop(el), h: el.offsetHeight, sp: parseFloat(el.dataset.parallax) || 0.1 }; });
    bands.forEach(function (b) { b.top = offTop(b.el); b.h = b.el.offsetHeight; });
  }

  /* pointer (desktop only) */
  var ptr = { tx: 0, ty: 0, x: 0, y: 0 };
  if (!REDUCE && !TOUCH) {
    window.addEventListener('pointermove', function (e) {
      ptr.tx = e.clientX / innerWidth - 0.5;
      ptr.ty = e.clientY / innerHeight - 0.5;
    }, { passive: true });
  }

  /* magnetic buttons */
  var mags = [];
  if (!REDUCE && !TOUCH) {
    document.querySelectorAll('.btn').forEach(function (btn) {
      var m = { el: btn, tx: 0, ty: 0, x: 0, y: 0, active: false };
      btn.addEventListener('pointerenter', function () { m.active = true; });
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        m.tx = ((e.clientX - r.left) / r.width - 0.5) * 10;
        m.ty = ((e.clientY - r.top) / r.height - 0.5) * 10;
      });
      btn.addEventListener('pointerleave', function () { m.active = false; m.tx = 0; m.ty = 0; });
      mags.push(m);
    });
  }

  /* marquees (driven from the main loop) */
  var marqs = [].slice.call(document.querySelectorAll('.marq')).map(function (mq) {
    var row = mq.querySelector('.marq__row');
    var o = { mq: mq, row: row, dir: mq.dataset.dir === 'rev' ? 1 : -1, sp: parseFloat(mq.dataset.speed) || 0.35, x: 0, half: 0, vis: true, hover: false };
    mq.addEventListener('pointerenter', function () { o.hover = true; });
    mq.addEventListener('pointerleave', function () { o.hover = false; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { o.vis = e[0].isIntersecting; }).observe(mq);
    }
    return o;
  });
  function measureMarq() { marqs.forEach(function (o) { if (o.row) o.half = o.row.scrollWidth / 2; }); }

  var lastY = -1, hdrLastY = 0, running = true;

  /* header responds on the scroll event too — resilient if rAF is throttled */
  function headerState() {
    if (!hdr) return;
    var y = window.scrollY || window.pageYOffset;
    hdr.style.setProperty('--scroll', (G.doc > 0 ? clamp(y / G.doc, 0, 1) : 0).toFixed(4));
    hdr.classList.toggle('is-stuck', y > 16);
    if (progScroll) { hdr.classList.remove('is-hidden'); hdrLastY = y; return; }
    var d = y - hdrLastY;
    if (Math.abs(d) > 3) {
      if (d > 0 && y > 300) hdr.classList.add('is-hidden');
      else if (d < 0) hdr.classList.remove('is-hidden');
      hdrLastY = y;
    }
    if (y <= 300) hdr.classList.remove('is-hidden');
  }
  window.addEventListener('scroll', headerState, { passive: true });

  function render(y) {
    var vh = G.vh, mob = G.mob;
    headerState();
    if (REDUCE) return;

    /* hero: content lifts & fades as you leave; ridges recede */
    if (hero && y < G.hero + vh) {
      var hp = clamp(y / (G.hero || vh), 0, 1);
      if (heroIn) {
        heroIn.style.transform = 'translate3d(0,' + (y * -0.14).toFixed(1) + 'px,0)';
        heroIn.style.opacity = clamp(1 - hp * 1.15, 0, 1).toFixed(3);
      }
      for (var i = 0; i < heroRidges.length; i++) {
        var d = (i + 1);
        heroRidges[i].style.transform = 'translate3d(' + (ptr.x * d * 6).toFixed(1) + 'px,' +
          (ptr.y * d * 2.4 - y * 0.03 * d).toFixed(1) + 'px,0)';
      }
    }

    /* oversized numerals — gentle parallax */
    for (var k = 0; k < G.px.length; k++) {
      var p = G.px[k];
      var mid = p.top + p.h / 2 - y - vh / 2;
      p.el.style.transform = 'translate3d(0,' + (-mid * p.sp * (mob ? 0.5 : 1)).toFixed(1) + 'px,0)';
    }

    /* Bali frame — scroll-linked image zoom */
    if (featScene && G.feat) {
      var enter = clamp((y + vh - G.feat.top) / (vh * 0.95), 0, 1); /* 0 as it appears, 1 fully in */
      featScene.style.transform = 'scale(' + (1.22 - 0.14 * enter).toFixed(4) + ')';
    }

    /* full-bleed bands — text drifts slower than scroll (cinematic) */
    for (var b = 0; b < bands.length; b++) {
      var bd = bands[b];
      if (y + vh < bd.top || y > bd.top + bd.h) continue;
      var rel = (bd.top + bd.h / 2) - (y + vh / 2);
      var amt = mob ? 0.05 : 0.09;
      if (bd.inner) bd.inner.style.transform = 'translate3d(0,' + clamp(rel * amt, -70, 70).toFixed(1) + 'px,0)';
      if (bd.scene) bd.scene.style.transform = 'translate3d(0,' + clamp(rel * 0.04, -40, 40).toFixed(1) + 'px,0)';
    }

    /* pipe — scroll-linked reveal of the four words */
    if (pipe && G.pipe) {
      var pp = clamp((y + vh * 0.72 - G.pipe.top) / (G.pipe.h * 0.7), 0, 1);
      var onCount = Math.round(pp * pipeDivs.length);
      for (var q = 0; q < pipeDivs.length; q++) pipeDivs[q].classList.toggle('on', q < onCount);
    }

    /* journey — route draws with scroll, steps activate */
    if (journey && G.journey) {
      var total = G.journey.h - vh;
      var jp = clamp((y - G.journey.top) / (total > 0 ? total : 1), 0, 1);
      if (jDraw && jLen) jDraw.style.strokeDashoffset = (jLen * (1 - jp)).toFixed(1);
      var act = Math.min(jSteps.length - 1, Math.floor(jp * jSteps.length + 0.12));
      for (var s = 0; s < jSteps.length; s++) jSteps[s].classList.toggle('on', s === act);
      for (var n = 0; n < jNodes.length; n++) jNodes[n].classList.toggle('on', n <= act);
    }
  }

  function loop() {
    if (!running) return;
    var y = window.scrollY || window.pageYOffset;

    /* pointer + magnetic easing (every frame, cheap) */
    if (!REDUCE && !TOUCH) {
      ptr.x = lerp(ptr.x, ptr.tx, 0.07);
      ptr.y = lerp(ptr.y, ptr.ty, 0.07);
      for (var m = 0; m < mags.length; m++) {
        var g = mags[m];
        g.x = lerp(g.x, g.active ? g.tx : 0, 0.18);
        g.y = lerp(g.y, g.active ? g.ty : 0, 0.18);
        g.el.style.transform = (Math.abs(g.x) < 0.05 && Math.abs(g.y) < 0.05 && !g.active)
          ? '' : 'translate3d(' + g.x.toFixed(2) + 'px,' + g.y.toFixed(2) + 'px,0)';
      }
    }

    /* marquees */
    for (var i = 0; i < marqs.length; i++) {
      var o = marqs[i];
      if (REDUCE || !o.vis || o.hover || !o.half) continue;
      o.x += o.dir * o.sp;
      if (o.x <= -o.half) o.x += o.half;
      if (o.x >= 0) o.x -= o.half;
      o.row.style.transform = 'translate3d(' + o.x.toFixed(1) + 'px,0,0)';
    }

    /* destinations — infinite carousel */
    if (CAR && CAR.vis && !REDUCE) {
      var now = performance.now();
      if (!CAR.auto && CAR.resume && now > CAR.resume) { CAR.auto = true; CAR.resume = 0; }
      if (CAR.auto && !CAR.drag) CAR.target -= 0.4;
      if (!CAR.drag) CAR.x += (CAR.target - CAR.x) * 0.12;
      if (CAR.set) {
        while (CAR.x <= -CAR.set) { CAR.x += CAR.set; CAR.target += CAR.set; }
        while (CAR.x > 0) { CAR.x -= CAR.set; CAR.target -= CAR.set; }
      }
      CAR.track.style.transform = 'translate3d(' + CAR.x.toFixed(2) + 'px,0,0)';
    }

    /* scroll-driven work only when position changed */
    if (y !== lastY) { render(y); lastY = y; }

    requestAnimationFrame(loop);
  }

  function boot() { measure(); measureMarq(); lastY = -1; headerState(); }
  window.addEventListener('load', boot);
  window.addEventListener('resize', function () {
    clearTimeout(window.__rtRz);
    window.__rtRz = setTimeout(boot, 150);
  });
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) { boot(); requestAnimationFrame(loop); }
  });

  boot();
  /* reduced-motion: no continuous loop — reveals via IO, header via scroll event */
  if (!REDUCE) requestAnimationFrame(loop);
  else {
    if (jDraw && jLen) jDraw.style.strokeDashoffset = 0;
    jSteps.forEach(function (s) { s.classList.add('on'); });
    jNodes.forEach(function (n) { n.classList.add('on'); });
    pipeDivs.forEach(function (d) { d.classList.add('on'); });
  }
})();
