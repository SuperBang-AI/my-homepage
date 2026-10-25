/* =========================================================
   main.js — 动效编排（GSAP）、顶栏状态、复制微信号
   动效只用 transform / opacity；所有效果尊重 prefers-reduced-motion
   ========================================================= */

(function () {
  "use strict";

  var doc = document;
  var cells = Array.prototype.slice.call(doc.querySelectorAll(".reveal"));
  var heroIntro = null; // 首屏开场时间轴，指针效果要等它跑完才接管按钮

  /* ---------- 1. 顶栏：滚动后出现细分隔线 + 阅读进度 ---------- */
  var head = doc.getElementById("site-head");
  var bar = doc.getElementById("read-progress");
  var lastScrolled = false;
  var barQueued = false;

  /* 1.5px 的陶土线：写 transform 而不是改 width，避免每帧触发布局 */
  function paintProgress() {
    barQueued = false;
    if (!bar) return;
    var max = doc.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? window.scrollY / max : 0;
    if (p < 0) p = 0;
    else if (p > 1) p = 1;
    bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
  }

  function onScroll() {
    var scrolled = window.scrollY > 8;
    if (scrolled !== lastScrolled && head) {
      head.classList.toggle("is-scrolled", scrolled);
      lastScrolled = scrolled;
    }
    if (!barQueued) {
      barQueued = true;
      window.requestAnimationFrame(paintProgress);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();

  /* 图片、字体就位后页面高度会变，进度线要按新高度重算一次 */
  window.addEventListener("load", paintProgress);

  /* ---------- 1.5 导航当前位置 ----------
     用视口正中一条细带来判定「我在哪一节」，避免两节同时命中。 */
  (function navSpy() {
    var links = {};
    Array.prototype.forEach.call(
      doc.querySelectorAll(".site-nav a[href^='#']:not(.nav-cta)"),
      function (a) {
        links[a.getAttribute("href").slice(1)] = a;
      }
    );

    var secs = ["projects", "about", "contact"].map(function (id) {
      return doc.getElementById(id);
    }).filter(Boolean);

    if (!("IntersectionObserver" in window) || !secs.length) return;

    function clearAll() {
      Object.keys(links).forEach(function (k) {
        links[k].classList.remove("is-active");
      });
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          clearAll();
          var link = links[en.target.id];
          if (link) link.classList.add("is-active");
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );

    secs.forEach(function (s) {
      io.observe(s);
    });
  })();

  /* ---------- 2. 兜底：GSAP 缺席时内容必须直出，绝不留白 ---------- */
  function showAll() {
    cells.forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  if (!window.gsap || !window.ScrollTrigger) {
    showAll();
  } else {
    buildMotion();
  }

  /* ---------- 3. 动效编排 ----------
     全站只做三件事：揭示层级（首屏）、解释系统（数字与流水线）、
     奖励转化（复制成功）。除此之外不加任何装饰性动效。 */
  function buildMotion() {
    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;

    gsap.registerPlugin(ScrollTrigger);

    var mm = gsap.matchMedia();

    /* 减少动效：一个 tween 都不建，直接落定 */
    mm.add("(prefers-reduced-motion: reduce)", showAll);

    /* 正常偏好 */
    mm.add("(prefers-reduced-motion: no-preference)", function () {
      var heroCell = doc.querySelector(".cell-hero");

      /* ---- 首屏：一次 1 秒左右的开场，把视线按在标题上 ---- */
      if (heroCell) {
        heroIntro = gsap.timeline({ defaults: { ease: "power3.out" } });

        heroIntro
          // 卡片本身不位移：位移全部让给文字，层级才出得来
          .set(heroCell, { y: 0 })
          .to(heroCell, { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, 0)
          .from(".hero__avatar", { scale: 0.9, autoAlpha: 0, duration: 0.6 }, 0.05)
          .from(".hero__who > *", { y: 8, autoAlpha: 0, duration: 0.5, stagger: 0.06 }, 0.14)
          // 标题两行各自从遮罩下方滑上来，第二行稍晚，读完刚好落定
          .from(".hero h1 .line__in", { yPercent: 110, duration: 0.9, stagger: 0.16 }, 0.16)
          .from(".hero__lead", { y: 12, autoAlpha: 0, duration: 0.7 }, 0.62)
          // 按钮用 fromTo 明确写出终点：from 是"以当前值为终点"，
          // 一旦这个补间被重新初始化，会把 10px 记成终点，按钮就停在半空。
          .fromTo(
            ".hero__actions .btn",
            { y: 10, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.07 },
            0.74
          )
          // 收尾把行内 transform 清干净：之后悬停/按压交给 CSS，磁吸交给 quickTo
          .set(".hero__actions .btn", { clearProps: "transform" }, 1.46);
      }

      /* ---- 其余卡片：进入视口浮起，卡内元素再分一层 ---- */
      var viewportH = window.innerHeight;

      cells.forEach(function (cell) {
        if (cell === heroCell) return;

        var card = cell.querySelector(".card");
        if (!card) return;

        // 首屏里本来就看得见的卡，等开场落定再动，别跟标题抢
        var inFirstScreen = cell.getBoundingClientRect().top < viewportH;

        var tl = gsap.timeline({
          delay: inFirstScreen ? 0.4 : 0,
          scrollTrigger: { trigger: cell, start: "top 88%", once: true }
        });

        tl.to(cell, { autoAlpha: 1, y: 0, duration: 0.8 });

        if (cell.classList.contains("cell-stats")) {
          statsIn(tl);
        } else if (cell.classList.contains("cell-about")) {
          aboutIn(tl);
        } else {
          tl.from(
            card.children,
            { y: 12, autoAlpha: 0, duration: 0.55, stagger: 0.05, ease: "power2.out" },
            "-=0.55"
          );

          // 卡片里的分组内容再细一层：绑在卡片自己的时间轴上，
          // 保证它们和卡片同进同出，不会出现「卡到了、内容还没亮」的空洞
          var loopItems = cell.querySelectorAll(".loop li");
          if (loopItems.length) {
            tl.from(
              loopItems,
              { autoAlpha: 0, x: -6, duration: 0.4, stagger: 0.07, ease: "power2.out" },
              "-=0.3"
            );
          }

          var flowItems = cell.querySelectorAll(".flow li");
          if (flowItems.length) {
            var flowAt = tl.duration() - 0.3;
            tl.from(
              flowItems,
              { autoAlpha: 0, x: 8, duration: 0.45, stagger: 0.07, ease: "power2.out" },
              flowAt
            );
            // 圆点用伪元素画，GSAP 动不了伪元素，改成逐帧写 CSS 变量：
            // 每颗点跟着自己那一行同时弹出来，看起来像流水线一级级点亮
            Array.prototype.forEach.call(flowItems, function (li, i) {
              var dot = { s: 0 };
              li.style.setProperty("--dot-scale", "0");
              tl.to(
                dot,
                {
                  s: 1,
                  duration: 0.5,
                  ease: "back.out(2.2)",
                  onUpdate: function () {
                    li.style.setProperty("--dot-scale", dot.s.toFixed(3));
                  }
                },
                flowAt + i * 0.07
              );
            });
          }
        }
      });

      // 图片与字体就位后重新量一次触发点，避免懒加载把位置算偏
      window.addEventListener("load", function () {
        ScrollTrigger.refresh();
      });
    });

    /* ---- 指针效果：只在鼠标设备 + 允许动效时注册；离开即解绑 ----
       触屏设备整个不进入这个分支，永远不会挂 pointermove。 */
    var pointerMM = gsap.matchMedia();
    pointerMM.add(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
      function () {
        return pointerEffects(gsap);
      }
    );

    function pointerEffects(gsap) {
      var heroCell = doc.querySelector(".cell-hero");
      var btn = doc.querySelector(".hero__actions .btn--primary");
      var glow = doc.querySelector(".hero__glow");
      // 聚光用 left:0/top:0 定位在卡片上，坐标要按卡片算，不是按 .cell 算
      var glowHost = glow ? glow.parentElement : heroCell;
      if (!heroCell) return;

      var RANGE = 26; // 指针离按钮边界多远开始被“吸”住
      var PULL = 0.14; // 位移衰减：指针走 1px，按钮跟 0.14px
      var MAX = 5; // 最多跟 5px，再多就像在弹跳

      var gx = null;
      var gy = null;
      var bx = null;
      var by = null;
      var home = null;
      var started = false;

      /* 必须等开场动画跑完再建 quickTo：
         它是以「当前值」为起点的补间，如果在 .from 把按钮压到 y:10 的那一刻创建，
         会把 10px 记成终点，按钮就永远停在半空（实测踩过）。 */
      function start() {
        if (started) return;
        started = true;

        if (glow) {
          gx = gsap.quickTo(glow, "x", { duration: 0.55, ease: "power2.out" });
          gy = gsap.quickTo(glow, "y", { duration: 0.55, ease: "power2.out" });
          // 开场落定之后才让光显形，不跟标题抢第一拍
          gsap.to(glow, { autoAlpha: 1, duration: 1.1, ease: "power2.out" });
        }

        if (btn) {
          bx = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3.out" });
          by = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3.out" });
        }

        centerGlow();
      }

      function centerGlow() {
        home = { x: glowHost.offsetWidth / 2, y: glowHost.offsetHeight / 2 };
        if (glow && gx) {
          gx(home.x);
          gy(home.y);
        }
      }

      function clamp(v) {
        return v > MAX ? MAX : v < -MAX ? -MAX : v;
      }

      function onMove(e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        // 开场动画还在跑：这一拍留给标题，不接管按钮
        if (heroIntro && heroIntro.isActive()) return;

        if (glow && gx) {
          var cr = glowHost.getBoundingClientRect();
          gx(e.clientX - cr.left);
          gy(e.clientY - cr.top);
        }

        if (btn && bx) {
          var br = btn.getBoundingClientRect();
          var dx = e.clientX - (br.left + br.width / 2);
          var dy = e.clientY - (br.top + br.height / 2);
          if (
            Math.abs(dx) > br.width / 2 + RANGE ||
            Math.abs(dy) > br.height / 2 + RANGE
          ) {
            bx(0);
            by(0);
            return;
          }
          bx(clamp(dx * PULL));
          by(clamp(dy * PULL));
        }
      }

      function onLeave() {
        if (btn && bx) {
          bx(0);
          by(0);
        }
        centerGlow();
      }

      /* 磁吸按钮的按下反馈：CSS :active 会被 GSAP 的行内 transform 盖掉，
         所以这个按钮的按压改由 JS 管，其余按钮仍走 CSS。 */
      function press() {
        gsap.to(btn, { scale: 0.975, duration: 0.1, overwrite: "auto" });
      }
      function release() {
        gsap.to(btn, { scale: 1, duration: 0.32, ease: "power2.out" });
      }

      heroCell.addEventListener("pointermove", onMove);
      heroCell.addEventListener("pointerleave", onLeave);
      window.addEventListener("resize", centerGlow);

      if (btn) {
        btn.addEventListener("pointerdown", press);
        btn.addEventListener("pointerup", release);
        btn.addEventListener("pointercancel", release);
        btn.addEventListener("pointerleave", release);
      }

      /* 开场还在跑就挂到 onComplete 上，跑完再接管按钮 */
      if (heroIntro && heroIntro.isActive()) {
        heroIntro.eventCallback("onComplete", start);
      } else {
        start();
      }

      return function cleanup() {
        heroCell.removeEventListener("pointermove", onMove);
        heroCell.removeEventListener("pointerleave", onLeave);
        window.removeEventListener("resize", centerGlow);
        if (btn) {
          btn.removeEventListener("pointerdown", press);
          btn.removeEventListener("pointerup", release);
          btn.removeEventListener("pointercancel", release);
          btn.removeEventListener("pointerleave", release);
          gsap.set(btn, { x: 0, y: 0, scale: 1, clearProps: "transform" });
        }
        if (glow) gsap.set(glow, { autoAlpha: 0 });
      };
    }

    /* ---- 数字带：五个数字从 0 滚到目标值 ---- */
    function statsIn(tl) {
      tl.from(
        ".stat",
        { y: 14, autoAlpha: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" },
        0.05
      );

      Array.prototype.forEach.call(doc.querySelectorAll(".stat__num"), function (el, i) {
        var target = parseInt(el.textContent, 10);
        if (isNaN(target)) return;

        var counter = { v: 0 };
        tl.to(
          counter,
          {
            v: target,
            duration: 1.1,
            ease: "power2.out",
            // 用 onStart 归零，而不是构建时归零：DOM 里的真实数字留到最后一刻
            onStart: function () {
              el.textContent = "0";
            },
            onUpdate: function () {
              el.textContent = Math.round(counter.v);
            },
            onComplete: function () {
              el.textContent = target;
            }
          },
          0.12 + i * 0.06
        );
      });
    }

    /* ---- 关于我：头像慢推，三段话逐句落笔 ---- */
    function aboutIn(tl) {
      tl.from(".about .eyebrow", { y: 10, autoAlpha: 0, duration: 0.5 }, "-=0.55")
        .from(
          ".about__avatar",
          { scale: 1.06, autoAlpha: 0, duration: 1.1, ease: "power2.out" },
          "-=0.5"
        )
        .from(
          ".about__body p",
          { y: 10, autoAlpha: 0, duration: 0.6, stagger: 0.1, ease: "power2.out" },
          "-=0.95"
        )
        .from(".about__sign", { autoAlpha: 0, duration: 0.6 }, "-=0.6");
    }
  }

  /* ---------- 4. 复制微信号 ---------- */
  var WECHAT_ID = "BangAI_Guide";
  var copyBtn = doc.getElementById("copy-wechat");
  var qrBox = doc.querySelector(".contact__qr");
  var toast = doc.getElementById("toast");
  var toastTimer = null;
  var labelTimer = null;
  var defaultLabel = copyBtn ? copyBtn.textContent.trim() : "";

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
    var ta = doc.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    doc.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = doc.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    doc.body.removeChild(ta);
    return ok;
  }

  /* 成功：按钮回弹 + 文案换成「已复制」，同时把视线推到二维码 */
  function markDone() {
    showToast("已复制 " + WECHAT_ID + "，去微信粘贴");

    if (copyBtn) {
      // 先锁宽度，换文案时按钮不跳动
      copyBtn.style.minWidth = copyBtn.offsetWidth + "px";
      copyBtn.textContent = "已复制 ✓";

      window.clearTimeout(labelTimer);
      labelTimer = window.setTimeout(function () {
        copyBtn.textContent = defaultLabel;
        copyBtn.style.minWidth = "";
      }, 2400);

      if (window.gsap) {
        window.gsap.fromTo(
          copyBtn,
          { scale: 1 },
          {
            scale: 0.955,
            duration: 0.12,
            yoyo: true,
            repeat: 1,
            ease: "power1.inOut",
            onComplete: function () {
              window.gsap.set(copyBtn, { clearProps: "transform" });
            }
          }
        );
      }
    }

    if (qrBox) {
      qrBox.classList.add("is-flash");
      window.setTimeout(function () {
        qrBox.classList.remove("is-flash");
      }, 700);
    }
  }

  /* 失败：不换文案，只轻轻抖一下，提示去手动输入 */
  function markFail() {
    showToast("复制失败，请手动输入 " + WECHAT_ID);
    if (window.gsap && copyBtn) {
      window.gsap.fromTo(
        copyBtn,
        { x: -3 },
        { x: 0, duration: 0.4, ease: "elastic.out(1, 0.5)", clearProps: "x" }
      );
    }
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(WECHAT_ID).then(markDone).catch(function () {
          legacyCopy(WECHAT_ID) ? markDone() : markFail();
        });
      } else {
        legacyCopy(WECHAT_ID) ? markDone() : markFail();
      }
    });
  }
})();
