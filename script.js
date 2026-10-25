/* =========================================================
   main.js — 入场编排、顶栏状态、复制微信号
   动效只用 transform / opacity；所有效果尊重 prefers-reduced-motion
   ========================================================= */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. 顶栏：滚动后出现细分隔线 ---------- */
  var head = document.getElementById("site-head");
  var lastState = false;

  function onScroll() {
    var scrolled = window.scrollY > 8;
    if (scrolled !== lastState && head) {
      head.classList.toggle("is-scrolled", scrolled);
      lastState = scrolled;
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 2. 卡片入场：一次编排，按视口内的顺序错峰 ---------- */
  var cells = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  if (reduceMotion || !("IntersectionObserver" in window)) {
    cells.forEach(function (el) {
      el.classList.add("is-in");
    });
  } else {
    var order = 0;
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          // 同一批进入视口的卡片依次错开 80ms，最多累计到 5 张
          var step = (order % 5) * 80;
          order += 1;
          el.style.setProperty("--delay", step + "ms");
          el.classList.add("is-in");
          observer.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    cells.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ---------- 3. 复制微信号 ---------- */
  var WECHAT_ID = "BangAI_Guide";
  var copyBtn = document.getElementById("copy-wechat");
  var toast = document.getElementById("toast");
  var toastTimer = null;

  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("is-show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-show");
    }, 2600);
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var done = function () {
        showToast("已复制 " + WECHAT_ID + "，去微信粘贴");
      };
      var fail = function () {
        showToast("复制失败，请手动输入 " + WECHAT_ID);
      };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(WECHAT_ID).then(done).catch(function () {
          legacyCopy(WECHAT_ID) ? done() : fail();
        });
      } else {
        legacyCopy(WECHAT_ID) ? done() : fail();
      }
    });
  }
})();
