// Playground — 使用 3D环形卡片组件 (RingCarousel)
document.addEventListener('DOMContentLoaded', () => {
  try {
  // 安全措施：确保ScrollTrigger已注册
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  // Creative Work 图片路径（16张循环使用，覆盖40张卡片）
  const cwImages = [];
  for (let i = 1; i <= 16; i++) {
    cwImages.push(`./assets/creativework/cw-${String(i).padStart(2, '0')}.png`);
  }

  // 卡片标题与描述
  const titles = [
    'AI Guidline', 'E2 LinkedMall', 'LAMBOSS Brand', 'Abstract Canvas',
    'Hi! Typography', 'Color Field', 'Subtle & Pervasive', 'Earth 3D Icon',
    'BackRoom SCP', 'Monmonkey IP', 'Shopify Editions', 'Gradient Wave',
    'Vitasilix Capsule', 'Microsoft Hub', 'Flowbite AI', 'Cloud Grid',
  ];

  const descriptions = [
    'AI产品设计准则，规范了人工智能场景下的交互模式、透明度要求和信任构建策略。',
    '电商平台体验重塑，从信息架构到交互细节的全链路设计优化。',
    'LAMBOSS品牌视觉体系，从Logo延展到完整的应用场景与数字媒体模板。',
    '抽象画布实验，探索色彩、纹理与构图的即兴碰撞。',
    '字体排版实验，挑战传统排版规则，探索字母的视觉表现力。',
    '色彩场域研究，通过大面积色块与微妙渐变构建视觉空间感。',
    '细微而普遍的设计哲学，在极简中寻找丰富的感官体验。',
    '3D地球图标设计，融合低多边形风格与精致光影。',
    '密室SCP故事可视化，用氛围渲染与叙事设计构建沉浸体验。',
    'Monmonkey IP角色设计，从概念草图到完整角色设定与表情系统。',
    'Shopify版本发布视觉，年度活动的品牌与信息设计。',
    '渐变波浪实验，探索流体色彩与动态曲线的视觉韵律。',
    'Vitasilix胶囊胃镜产品，医疗科技的友好视觉与交互设计。',
    'Microsoft Office Hub界面设计，工具集合的信息架构与导航优化。',
    'Flowbite AI构建器，AI驱动的设计工具交互与界面设计。',
    '云网格可视化，数据网络拓扑的视觉表达与交互探索。',
  ];

  // 生成40张卡片数据：16张图片循环
  const cardData = [];
  for (let i = 0; i < 40; i++) {
    const idx = i % 16;
    cardData.push({
      title: titles[idx],
      image: cwImages[idx],
      desc: descriptions[idx],
    });
  }

  // 初始化 RingCarousel
  const carousel = new RingCarousel('#ring-container', {
    data: cardData,
    radius: 445,
    speed: 0.40,
    tilt: 22,
    cardRotate: 90,
    autoSpeed: 0.08,
    cardWidth: 120,
    cardHeight: 160,
    accent: '#4a90d9',
  });

  // ========================================
  // 角标打乱解码动画
  // ========================================
  const SCRAMBLE_POOL = '0123456789█▓▒░◇◆□■△▽⊕⊗';

  function getRandomDigit() {
    return SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)];
  }

  // 对单个角标执行打乱解码动画
  function scrambleSingleBadge(badge) {
    if (badge.querySelector('.cw-badge-char')) return; // 避免重复
    const original = badge.getAttribute('data-badge');
    badge.innerHTML = '';
    for (let i = 0; i < original.length; i++) {
      const span = document.createElement('span');
      span.className = 'cw-badge-char';
      span.textContent = original[i];
      span.dataset.original = original[i];
      badge.appendChild(span);
    }

    const chars = badge.querySelectorAll('.cw-badge-char');
    chars.forEach((span, idx) => {
      const orig = span.dataset.original;
      setTimeout(() => {
        let elapsed = 0;
        const duration = 2000;
        const interval = 60;
        const timer = setInterval(() => {
          elapsed += interval;
          if (elapsed >= duration) {
            clearInterval(timer);
            span.textContent = orig;
          } else {
            span.textContent = getRandomDigit();
          }
        }, interval);
      }, idx * 25);
    });
  }

  // 对一行角标执行打乱动画（逐个错开）
  function scrambleRow(badges, stagger) {
    badges.forEach((badge, i) => {
      setTimeout(() => scrambleSingleBadge(badge), i * stagger);
    });
  }

  // 1. RingCarousel内的角标：滚动到ring-container区域时触发
  //    出场动画4秒+滚动到可视区域时才播放
  const ringContainer = document.getElementById('ring-container');
  if (ringContainer) {
    const ringObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          ringObserver.disconnect();
          // 等出场动画完成后触发
          const minDelay = Math.max(0, 4200 - performance.now());
          setTimeout(() => {
            const ringBadges = document.querySelectorAll('.rc-card .cw-badge[data-badge]');
            console.log('[Badge] RingCarousel角标数量:', ringBadges.length);
            ringBadges.forEach((badge, i) => {
              setTimeout(() => scrambleSingleBadge(badge), i * 30);
            });
          }, minDelay);
        }
      });
    }, { threshold: 0.1 });
    ringObserver.observe(ringContainer);
  }

  // 2. Sandbox-grid角标：滚动到视口时按行触发
  //    sandbox数据是异步fetch加载的，需等DOM就绪后再绑定IntersectionObserver
  function setupGridBadgeScrollTrigger() {
    const sandboxGrid = document.getElementById('sandbox-grid');
    if (!sandboxGrid) return;

    const badges = sandboxGrid.querySelectorAll('.cw-badge[data-badge]');
    if (badges.length === 0) return;

    console.log('[Badge] Sandbox-grid角标数量:', badges.length);

    // 按行分组：假设8列grid，每8个为一行
    const COLS = 8;
    const rows = [];
    for (let i = 0; i < badges.length; i += COLS) {
      rows.push(Array.from(badges).slice(i, i + COLS));
    }

    // 对每一行使用IntersectionObserver：进入视口时触发该行动画
    rows.forEach((row, rowIdx) => {
      // 用每行第一个角标作为触发锚点
      const trigger = row[0].closest('.cw-item') || row[0];
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            observer.disconnect(); // 只触发一次
            scrambleRow(row, 50); // 每个角标错开50ms
          }
        });
      }, {
        rootMargin: '0px 0px -50px 0px', // 稍微延迟触发
        threshold: 0.1
      });
      observer.observe(trigger);
    });
  }

  // 等sandbox数据加载完再初始化
  const sandboxGrid = document.getElementById('sandbox-grid');
  if (sandboxGrid) {
    const existingBadges = sandboxGrid.querySelectorAll('.cw-badge[data-badge]');
    if (existingBadges.length > 0) {
      setupGridBadgeScrollTrigger();
    } else {
      // 监听DOM变化，等待角标被添加
      const domObserver = new MutationObserver(() => {
        const badges = sandboxGrid.querySelectorAll('.cw-badge[data-badge]');
        if (badges.length > 0) {
          domObserver.disconnect();
          setupGridBadgeScrollTrigger();
        }
      });
      domObserver.observe(sandboxGrid, { childList: true, subtree: true });
      setTimeout(() => domObserver.disconnect(), 10000);
    }
  }

  } catch (e) {
    console.error('[playground.js] Error:', e);
  }
});
