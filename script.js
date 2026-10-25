/* =========================================================
   main.js — 动效编排（GSAP）、顶栏状态、复制微信号
   动效只用 transform / opacity；所有效果尊重 prefers-reduced-motion
   ========================================================= */

(function () {
  "use strict";

  var doc = document;
  var cells = Array.prototype.slice.call(doc.querySelectorAll(".reveal"));

  /* ---------- 1. 顶栏：滚动后出现细分隔线 ---------- */
  var head = doc.getElementById("site-head");
  var lastScrolled = false;

  function onScroll() {
    var scrolled = window.scrollY > 8;
    if (scrolled !== lastScrolled && head) {
      head.classList.toggle("is-scrolled", scrolled);
      lastScrolled = scrolled;
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

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
        var intro = gsap.timeline({ defaults: { ease: "power3.out" } });

        intro
          // 卡片本身不位移：位移全部让给文字，层级才出得来
          .set(heroCell, { y: 0 })
          .to(heroCell, { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, 0)
          .from(".hero__avatar", { scale: 0.9, autoAlpha: 0, duration: 0.6 }, 0.05)
          .from(".hero__who > *", { y: 8, autoAlpha: 0, duration: 0.5, stagger: 0.06 }, 0.14)
          // 标题两行各自从遮罩下方滑上来，第二行稍晚，读完刚好落定
          .from(".hero h1 .line__in", { yPercent: 110, duration: 0.9, stagger: 0.16 }, 0.16)
          .from(".hero__lead", { y: 12, autoAlpha: 0, duration: 0.7 }, 0.62)
          .from(".hero__actions .btn", { y: 10, autoAlpha: 0, duration: 0.6, stagger: 0.07 }, 0.74);
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
