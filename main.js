/**
 * Jianyu Portfolio GSAP Animations
 */

document.addEventListener("DOMContentLoaded", () => {
  try {
  // Fade-in page on load
  gsap.from('body', { opacity: 0, duration: 0.5, ease: 'power2.out' });
  // Register ScrollTrigger
  gsap.registerPlugin(ScrollTrigger);

  // Lenis 平滑滚动 - 自然丝滑的惯性效果
  const lenis = new Lenis({
    duration: 1.2,          // 滚动持续时间
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // 自然缓动
    smoothWheel: true,      // 鼠标滚轮平滑
    touchMultiplier: 2,     // 触摸灵敏度
  });

  // 将 Lenis 与 GSAP ScrollTrigger 同步
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  // ========================================
  // 0. 吸顶导航 — 滚动消失后丝滑滑入
  // ========================================
  const originalNav = document.querySelector('.nav');
  if (originalNav) {
    // 克隆导航作为吸顶版本
    const fixedNav = originalNav.cloneNode(true);
    fixedNav.classList.add('nav-fixed');
    document.body.appendChild(fixedNav);

    // 用 ScrollTrigger 检测原始导航是否离开视口
    ScrollTrigger.create({
      trigger: originalNav,
      start: 'bottom top',   // 原始导航底部到达视口顶部时
      onEnter: () => {
        // 原始导航刚消失 → 固定导航向下滑入
        fixedNav.classList.add('nav-visible');
        gsap.fromTo(fixedNav,
          { y: -fixedNav.offsetHeight },
          { y: 0, duration: 0.4, ease: 'power3.out' }
        );
      },
      onLeaveBack: () => {
        // 回滚至原始导航区域 → 隐藏固定导航
        gsap.to(fixedNav, {
          y: -fixedNav.offsetHeight,
          duration: 0.3,
          ease: 'power2.in',
          onComplete: () => {
            fixedNav.classList.remove('nav-visible');
          }
        });
      }
    });

    // 给克隆导航中的链接绑定同样的行为
    fixedNav.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href');
      if (href && href !== '#') {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          gsap.to('body', {
            opacity: 0,
            duration: 0.5,
            ease: 'power2.in',
            onComplete: () => { window.location.href = href; }
          });
        });
      }
    });
  }

  // ========================================
  // 0.5 Words Stagger — Spell UI 逐词错落入场动画
  //    模拟 Spell UI WordsStagger 组件效果：
  //    每个词/字从 blur(10px) + opacity:0 + y:10
  //    错落依次过渡到 blur(0px) + opacity:1 + y:0
  // ========================================
  const staggerEls = document.querySelectorAll('.words-stagger');
  staggerEls.forEach(el => {
    const text = el.getAttribute('data-text') || el.textContent;

    // 智能拆分：中文按单字拆分，英文按单词拆分，保留标点附着
    const units = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      // 中文字符（CJK 统一汉字范围）
      if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
        units.push(ch);
        i++;
      }
      // 中文标点 — 附着到前一个单位
      else if (/[\u3000-\u303f\uff00-\uffef，。、；：！？…—""''（）【】《》]/.test(ch)) {
        if (units.length > 0) {
          units[units.length - 1] += ch;
        } else {
          units.push(ch);
        }
        i++;
      }
      // 英文/数字 — 合并为一个单词
      else if (/[a-zA-Z0-9]/.test(ch)) {
        let word = '';
        while (i < text.length && /[a-zA-Z0-9]/.test(text[i])) {
          word += text[i];
          i++;
        }
        units.push(word);
      }
      // 空格 — 跳过（词间距通过 margin 实现）
      else if (/\s/.test(ch)) {
        i++;
      }
      // 其他字符（如 · & 等）单独处理
      else {
        units.push(ch);
        i++;
      }
    }

    el.innerHTML = '';

    const wordSpans = units.map((unit, idx) => {
      const span = document.createElement('span');
      span.className = 'stagger-word';
      span.textContent = unit;
      el.appendChild(span);
      return span;
    });

    // Spell UI WordsStagger: hidden state — blur(10px), opacity: 0, y: 10
    gsap.set(wordSpans, {
      filter: 'blur(10px)',
      opacity: 0,
      y: 10
    });

    // ScrollTrigger 触发逐词错落动画（Spell UI: staggerChildren + delayChildren）
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      onEnter: () => {
        gsap.to(wordSpans, {
          filter: 'blur(0px)',
          opacity: 1,
          y: 0,
          duration: 0.5,           // Spell UI speed 参数
          ease: 'power2.out',      // Spell UI easeOut
          stagger: 0.06            // Spell UI stagger 参数 — 逐字错落间隔
        });
      },
      once: true
    });
  });

  // ========================================
  // 0.6 Special Text — Spell UI 字符打乱解码动画
  //    效果：文字从随机字符快速跳动，逐字"解码"还原为正常文本
  //    类似代码/黑客风格的随机切换 → 逐字锁定
  //
  //    两种模式：
  //    .special-text      → 标题用：有模糊+透明度过渡（沉浸感）
  //    .special-text-body → 正文用：无模糊无透明度（纯字符跳动）
  // ========================================

  // 随机字符池 — 中文用方块/符号感字符，英文用代码符号
  const SCRAMBLE_POOL_LATIN = '!@#$%^&*<>{}[]|/\\~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const SCRAMBLE_POOL_CJK = '█▓▒░╔╗╚╝═║╬╠╣╦╩▀▄⌬⏣⎔◇◆□■△▽⊕⊗⟟⏢⎳◈▣▧▦▩▪▫';

  function getRandomChar(originalChar) {
    const isCJK = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(originalChar);
    const pool = isCJK ? SCRAMBLE_POOL_CJK : SCRAMBLE_POOL_LATIN;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 通用的打乱解码初始化函数
  function initScrambleText(el, options = {}) {
    const {
      useBlur = true,        // 是否使用模糊效果
      scrambleDuration = 600, // 每个字的打乱持续时间 (ms)
      scrambleInterval = 35,  // 每次切换间隔 (ms)
      staggerDelay = 70       // 逐字错开延迟 (ms)
    } = options;

    // 从 data-text 获取原始文本（避免 HTML 实体解码问题）
    const originalText = el.getAttribute('data-text') || el.textContent;

    // 拆分为单个字符的 span
    const chars = [];
    el.innerHTML = '';

    for (let i = 0; i < originalText.length; i++) {
      const ch = originalText[i];
      const span = document.createElement('span');
      span.className = 'special-char';
      span.textContent = ch;
      span.dataset.original = ch;
      el.appendChild(span);
      chars.push({
        span: span,
        original: ch,
        isSpace: /\s/.test(ch)
      });
    }

    // 初始状态：所有非空格字符显示为随机字符
    chars.forEach(c => {
      if (!c.isSpace) {
        c.span.textContent = getRandomChar(c.original);
        if (useBlur) {
          // 标题模式：随机字符 + 微弱模糊 + 低透明度
          gsap.set(c.span, {
            opacity: 0.4,
            filter: 'blur(2px)'
          });
        }
        // 正文模式（useBlur=false）：随机字符但保持完全不透明、无模糊
      }
    });

    // 滚动触发解码动画 — start 设为 'top 100%' 确保元素刚进入视口就触发
    ScrollTrigger.create({
      trigger: el,
      start: 'top 100%',
      onEnter: () => {
        chars.forEach((c, idx) => {
          if (c.isSpace) return;

          // 使用 setTimeout 实现逐字错开启动
          setTimeout(() => {
            let elapsed = 0;

            // 打乱阶段：快速切换随机字符
            const timer = setInterval(() => {
              elapsed += scrambleInterval;

              if (elapsed >= scrambleDuration) {
                clearInterval(timer);
                // 解码完成 — 显示正确字符
                c.span.textContent = c.original;
                c.span.classList.add('decoded');
                if (useBlur) {
                  // 标题模式：从模糊低透明度过渡到清晰
                  gsap.to(c.span, {
                    opacity: 1,
                    filter: 'blur(0px)',
                    duration: 0.3,
                    ease: 'power2.out'
                  });
                }
              } else {
                // 继续打乱 — 随机切换字符
                c.span.textContent = getRandomChar(c.original);
              }
            }, scrambleInterval);
          }, idx * staggerDelay);
        });
      },
      once: true
    });
  }

  // 初始化标题打乱效果（有模糊+透明度）
  document.querySelectorAll('.special-text').forEach(el => {
    initScrambleText(el, { useBlur: true });
  });

  // 初始化正文打乱效果（无模糊、无透明度变化）
  document.querySelectorAll('.special-text-body').forEach(el => {
    initScrambleText(el, { useBlur: false, scrambleDuration: 400, staggerDelay: 30 });
  });

  // ========================================
  // 1. 滚动淡入动画
  // ========================================
  const fadeUpElements = document.querySelectorAll('.g-fade-up');

  // expose for transition sync
  window.fadeUpElementsGlobal = Array.from(fadeUpElements || []);

  if (fadeUpElements.length > 0) {
    fadeUpElements.forEach((el) => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none none"
        },
        y: 40,
        opacity: 0,
        duration: 1,
        ease: "power3.out"
      });
    });
  }

  // ========================================
  // 1.2 Cursor Trail — hero 区域鼠标跟随图标 + 掉落物理效果
  // ========================================
  const heroSection = document.querySelector('.hero');
  if (heroSection) {
    const trailIcons = [
      './flowicon/1@1x.png',
      './flowicon/2@1x.png',
      './flowicon/3@1x.png',
      './flowicon/4@1x.png',
      './flowicon/5@1x.png',
      './flowicon/6@1x.png',
      './flowicon/7@1x.png',
      './flowicon/8@1x.png'
    ];
    const POOL_SIZE = 20;
    const SPAWN_INTERVAL = 80;
    const pool = [];
    let poolIndex = 0;
    let lastSpawnTime = 0;

    // 预创建图标元素添加到 body（fixed 定位）
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'trail-icon';
      const img = document.createElement('img');
      img.src = trailIcons[i % trailIcons.length];
      el.appendChild(img);
      document.body.appendChild(el);
      pool.push(el);
    }

    heroSection.addEventListener('mousemove', (e) => {
      const now = Date.now();
      if (now - lastSpawnTime < SPAWN_INTERVAL) return;
      lastSpawnTime = now;

      // 直接使用视口坐标（配合 position: fixed）
      const cx = e.clientX;
      const cy = e.clientY;

      const icon = pool[poolIndex];
      poolIndex = (poolIndex + 1) % POOL_SIZE;

      // 随机图标
      icon.querySelector('img').src = trailIcons[Math.floor(Math.random() * trailIcons.length)];

      const initRotation = gsap.utils.random(-30, 30);
      const scale = gsap.utils.random(0.8, 1.4);

      gsap.killTweensOf(icon);

      // 定位到鼠标位置（视口坐标）
      gsap.set(icon, {
        left: cx - 20,
        top: cy - 20,
        x: 0,
        y: 0,
        opacity: 1,
        scale: 0,
        rotation: initRotation
      });

      // 阶段1：弹出
      gsap.to(icon, {
        scale: scale,
        opacity: 1,
        duration: 0.25,
        ease: 'back.out(2)',
        onComplete: () => {
          // 阶段2：掉落
          const fallDelay = gsap.utils.random(0.1, 0.4);
          const fallDuration = gsap.utils.random(0.8, 1.4);
          const xDrift = gsap.utils.random(-60, 60);
          const spinAngle = gsap.utils.random(-180, 180);

          gsap.to(icon, {
            y: gsap.utils.random(300, 600),      // 向下掉落
            x: xDrift,                             // 水平漂移
            rotation: initRotation + spinAngle,
            opacity: 0,
            scale: scale * 0.5,
            duration: fallDuration,
            delay: fallDelay,
            ease: 'power2.in'
          });
        }
      });
    });
  }

  // ========================================
  // 1.5 作品卡片点击 → 淡出 → 跳转详情页
  // ========================================
  const projectCards = document.querySelectorAll('.project-card');
  projectCards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      gsap.to('body', {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => {
          window.location.href = 'detail.html';
        }
      });
    });
  });

  // ========================================
  // 1.8 Footer 空间嵌套感视差滚动效果
  try {
  //    黑色背景层 100vh 作为蒙版裁剪容器，1:1 正常滚动
  //    文字层在"世界绝对位置"中几乎不动，仅向上移动320px到结束位置
  //    背景像蒙版一样滑过文字，文字被overflow:hidden裁剪
  //    形成强烈速度差：背景大步流星，文字像嵌在水泥里
  //
  //    数学原理：
  //    背景滚动 100vh，文字在视口中只移 320px
  //    → 文字相对footer需反向补偿 (100vh - 320px)
  //    → 初始 y = -(100vh - 320)，结束时 y = 0（自然位置）
  // ========================================
  const footerEl = document.querySelector('.footer');
  const footerContent = document.querySelector('.footer-content');

  if (footerEl && footerContent) {
    // 文字层从"世界绝对位置"开始，初始在footer可见区域上方（被裁剪不可见）
    // 滚动过程中逐渐进入黑色蒙版的可见区域，到结束时到达自然位置
    // 注意：fromTo的from值必须是即时计算值，不能用函数（GSAP 3.12的from不支持函数值）
    const footerStartY = -(window.innerHeight - 320);  // 初始偏移：视口高度减去320px位移
    gsap.fromTo(footerContent,
      { y: footerStartY },                         // 初始：在footer可见区上方，被裁剪（位移320px）
      {
        y: 0,                                      // 结束：到达自然位置
        ease: 'none',
        scrollTrigger: {
          trigger: footerEl,
          start: 'top bottom',                    // footer顶部到达视口底部时开始
          end: 'top top',                         // footer顶部到达视口顶部时结束
          scrub: true,                            // 与滚动同步
          invalidateOnRefresh: true,              // 窗口resize时重新计算
        }
      }
    );
  }

  // ========================================
  // 2. Footer 悬停动画
  // ========================================
  const footerLinks = document.querySelectorAll('.footer-link');

  footerLinks.forEach(link => {
    const innerText = link.querySelector('.text-inner');
    if (!innerText) return;

    // Create the hover text element
    const hoverText = document.createElement('span');
    hoverText.className = 'text-hover';
    hoverText.innerHTML = innerText.innerHTML;
    link.appendChild(hoverText);

    // Initial state
    gsap.set(innerText, { yPercent: 0 });
    gsap.set(hoverText, { yPercent: 0 });

    // Create animation timeline
    const tl = gsap.timeline({ paused: true, defaults: { duration: 0.4, ease: "power3.inOut" } });
    tl.to(innerText, { yPercent: -100 }, 0)
      .to(hoverText, { yPercent: -100 }, 0);

    link.addEventListener('mouseenter', () => tl.play());
    link.addEventListener('mouseleave', () => tl.reverse());
  });

  } catch (e) {
    console.warn('[main.js] Footer section error:', e);
  }

  // ========================================
  // Page Transitions - Grid/Stripe Fragment Transition (GSAP)
  // ========================================
  // Toggle for enabling/disabling the fragment page transition
  const ENABLE_TRANSITION = false; // set to true to enable

  // Create an overlay with tiles that animate as fragments during page changes.
  const transition = {
    overlay: null,
    tiles: [],
    cols: 0,
    rows: 0,
    async create() {
      // remove existing if any
      if (this.overlay) { this.overlay.remove(); this.tiles = []; }
      const overlay = document.createElement('div');
      overlay.id = 'page-transition-overlay';
      Object.assign(overlay.style, {
        position: 'fixed', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20000, overflow: 'hidden'
      });
      document.body.appendChild(overlay);

    // compute grid based on a target tile size
    const tileTarget = Math.max(60, Math.round(window.innerWidth / 12));
      const cols = Math.ceil(window.innerWidth / tileTarget);
      const rows = Math.ceil(window.innerHeight / tileTarget);
      this.cols = cols; this.rows = rows; this.overlay = overlay;

      const tileW = Math.ceil(window.innerWidth / cols);
      const tileH = Math.ceil(window.innerHeight / rows);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tile = document.createElement('div');
          tile.className = 'pt-tile';
          Object.assign(tile.style, {
            position: 'absolute',
            width: tileW + 'px',
            height: tileH + 'px',
            left: (c * tileW) + 'px',
            top: (r * tileH) + 'px',
            background: '#111',
            transformOrigin: 'center',
            willChange: 'transform, opacity'
          });
          overlay.appendChild(tile);
          this.tiles.push(tile);
        }
      }

      // prepare ordered tiles (column-first) for left-to-right stripe animation
      this.orderedTiles = [];
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const idx = r * cols + c;
          this.orderedTiles.push(this.tiles[idx]);
        }
      }

      // basic CSS for overlay tiles (ensure no transitions from CSS)

      // dynamically load html2canvas and capture the page to create realistic tile backgrounds
      try {
        if (typeof html2canvas === 'undefined') {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        // small delay to let layout stabilize
        await new Promise(r => setTimeout(r, 50));

        // If there's a previous-page snapshot saved in sessionStorage, use it (this lets the new page reveal the previous visual).
        const prevKey = 'pt_prev_snapshot';
        let dataURL, imgW, imgH;
        const prevRaw = sessionStorage.getItem(prevKey);
        if (prevRaw) {
          try {
            const parsed = JSON.parse(prevRaw);
            if (parsed && parsed.dataURL) {
              dataURL = parsed.dataURL;
              imgW = parsed.w; imgH = parsed.h;
              // remove after use
              sessionStorage.removeItem(prevKey);
            }
          } catch (err) {
            // fall back to capturing
            console.warn('failed to parse previous pt snapshot', err);
          }
        }

        // if no previous snapshot, capture current document
        if (!dataURL) {
          const canvas = await html2canvas(document.documentElement, { scale: 1 });
          dataURL = canvas.toDataURL('image/png');
          imgW = canvas.width; imgH = canvas.height;
        }

        // cache the last snapshot in the instance for callers (cover will save to sessionStorage before navigation)
        this.lastSnapshot = { dataURL, w: imgW, h: imgH };

        // apply tile backgrounds with correct background-position
        for (let i = 0; i < this.tiles.length; i++) {
          const t = this.tiles[i];
          const left = parseInt(t.style.left, 10) || 0;
          const top = parseInt(t.style.top, 10) || 0;
          Object.assign(t.style, {
            backgroundImage: `url(${dataURL})`,
            backgroundPosition: `-${left}px -${top}px`,
            backgroundSize: `${imgW}px ${imgH}px`,
            backgroundRepeat: 'no-repeat'
          });
        }
      } catch (err) {
        // if snapshot fails, leave tiles as solid color
        console.warn('html2canvas failed for transition tiles', err);
      }

      // return snapshot metadata for caller convenience
      return this.lastSnapshot;
    },
    async cover({ duration = 0.8, stagger = 0.02, direction = 'columns' } = {}) {
      // ensure overlay exists and capture snapshot if needed
      const snapshot = await this.create();
      // store snapshot to sessionStorage so the next page can pick it up for reveal
      try {
        const prevKey = 'pt_prev_snapshot';
        sessionStorage.setItem(prevKey, JSON.stringify(snapshot));
      } catch (e) { /* ignore storage errors */ }

      const tiles = this.tiles;
      this.overlay.style.pointerEvents = 'auto';
      // prepare tiles: scaleY 0 -> 1 (cover) for stripe effect
      gsap.set(tiles, { scaleY: 0, transformOrigin: 'top center', y: 0, opacity: 1 });
      // return a Promise that resolves when timeline completes
      return new Promise((resolve) => {
        const tl = gsap.timeline({ onComplete: () => { resolve(); } });
        // set initial state: invisible, collapsed, blurred
        gsap.set(this.orderedTiles, { scaleY: 0, transformOrigin: 'top center', opacity: 0, filter: 'blur(10px)' });
        tl.to(this.orderedTiles, {
          scaleY: 1,
          opacity: 1,
          filter: 'blur(0px)',
          duration: duration,
          ease: 'power3.inOut',
          stagger: stagger
        });
      });
    },
    reveal({ duration = 0.6, stagger = 0.02 } = {}) {
      if (!this.overlay) return Promise.resolve();
      return new Promise((resolve) => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' }, onComplete: () => { if (this.overlay) this.overlay.style.pointerEvents = 'none'; resolve(); } });
        // hide in reverse left-to-right order
        tl.to(this.orderedTiles.slice().reverse(), {
          scaleY: 0,
          opacity: 0,
          filter: 'blur(10px)',
          duration: duration,
          stagger: stagger
        });
      }).then(() => {
        // after reveal completes, play entrance animations for fadeUpElements to sync
        if (window.fadeUpElementsGlobal && window.fadeUpElementsGlobal.length) {
          window.fadeUpElementsGlobal.forEach((el) => {
            gsap.killTweensOf(el);
            gsap.fromTo(el, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out' });
          });
        }
      });
    }
  };

  // initialize overlay on first load (cover then reveal)
  if (ENABLE_TRANSITION) {
    transition.create().then(() => {
      // start with overlay covering then reveal after small delay
      gsap.set(transition.tiles, { scaleY: 1, transformOrigin: 'top center' });
      // reveal once DOM is ready (shorter duration)
      gsap.delayedCall(0.08, () => {
        transition.reveal({ duration: 0.35, stagger: 0.02 });
      });
    }).catch((err) => {
      console.warn('transition.create failed', err);
    });
  } else {
    // page transitions are disabled by configuration
  }

  // helper to detect internal links
  function isInternalLink(href) {
    if (!href) return false;
    if (href.startsWith('#')) return false; // anchors
    try {
      const url = new URL(href, location.href);
      return url.origin === location.origin;
    } catch (e) { return false; }
  }

  // Intercept clicks on internal links site-wide to play transition
  if (ENABLE_TRANSITION) {
    document.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href');
      if (!isInternalLink(href)) return;
      if (a.target === '_blank') return;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const dest = a.href;
        // play cover animation (which saves snapshot) then navigate
        transition.cover({ duration: 0.8, stagger: 0.02 }).then(() => {
          // small delay to ensure visual
          setTimeout(() => { location.href = dest; }, 50);
        }).catch((err) => {
          // fallback: navigate immediately on error
          console.warn('transition.cover failed', err);
          location.href = dest;
        });
      });
    });
  } else {
    // transitions disabled: do not intercept links
  }

  // ========================================
  // 3. About 页面 Cursor-Tracking Image Preview
  //    使用双图层交替淡入淡出实现丝滑切换
  //    ⚠️ 已暂时禁用 — 人物照片替换为静态图片
  // ========================================
  const ENABLE_ABOUT_PREVIEW = true; // 设为 false 可禁用

  const aboutPreview = document.getElementById('about-preview');
  const aboutRows = document.querySelectorAll('.about-row');

  if (ENABLE_ABOUT_PREVIEW && aboutPreview && aboutRows.length > 0) {
    const layerA = document.getElementById('layer-a');
    const layerB = document.getElementById('layer-b');
    const images = [
      './assets/Qianxin Qaxgpt Experience Design.png',
      './assets/QAX Design System.png',
      './assets/QAX New Style.png',
      './assets/Qax-gpt Brand Design.png',
      './assets/Qax-AI Motion Design.png',
      './assets/QAX Dashboard Discovery.png',
      './assets/QAX-AI Guidline.png'
    ];

    let activeLayer = 'a';     // 当前显示的图层
    let lastImgSrc = '';       // 上一次显示的图片路径
    let mouseX = 0, mouseY = 0;

    // 使用 GSAP quickTo 实现丝滑的鼠标跟踪
    const xTo = gsap.quickTo(aboutPreview, "x", { duration: 0.6, ease: "power3.out" });
    const yTo = gsap.quickTo(aboutPreview, "y", { duration: 0.6, ease: "power3.out" });

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (gsap.getProperty(aboutPreview, "opacity") > 0) {
        xTo(mouseX - 200);
        yTo(mouseY - 150);
      }
    });

    // 获取一张随机图片（避免与上次重复）
    function getRandomImage() {
      let img;
      do {
        img = images[Math.floor(Math.random() * images.length)];
      } while (img === lastImgSrc && images.length > 1);
      lastImgSrc = img;
      return img;
    }

    // 切换图片 — 双图层淡入淡出
    function crossfadeToImage(imgSrc) {
      const incoming = activeLayer === 'a' ? layerB : layerA;
      const outgoing = activeLayer === 'a' ? layerA : layerB;

      // 预加载图片
      const preload = new Image();
      preload.src = imgSrc;
      preload.onload = () => {
        incoming.style.backgroundImage = `url('${imgSrc}')`;

        // 淡入新图层 + 微缩放
        gsap.to(incoming, {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          ease: "power2.out"
        });
        // 淡出旧图层
        gsap.to(outgoing, {
          opacity: 0,
          scale: 1.1,
          duration: 0.5,
          ease: "power2.out"
        });

        activeLayer = activeLayer === 'a' ? 'b' : 'a';
      };
    }

    aboutRows.forEach(row => {
      row.addEventListener('mouseenter', () => {
        const randomImg = getRandomImage();
        crossfadeToImage(randomImg);

        // 立即定位到鼠标处
        gsap.set(aboutPreview, {
          x: mouseX - 200,
          y: mouseY - 150,
        });

        // 容器淡入
        gsap.to(aboutPreview, {
          opacity: 1,
          scale: 1,
          duration: 0.4,
          ease: "power3.out"
        });
      });

      row.addEventListener('mouseleave', () => {
        gsap.to(aboutPreview, {
          opacity: 0,
          scale: 0.85,
          duration: 0.35,
          ease: "power3.in"
        });
      });
    });
  }

  } catch (e) {
    // 捕获footer视差或其它动画的运行时错误，防止脚本中断
    console.warn('Animation section error:', e);
  }
});
