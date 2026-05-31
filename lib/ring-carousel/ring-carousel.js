/**
 * RingCarousel - 3D 环形交互卡片组件
 * 
 * 纯原生 JavaScript 实现，无框架依赖
 * 依赖：GSAP 3.x（含 Observer、Draggable 插件）
 * 
 * 使用示例：
 *   const carousel = new RingCarousel('#container', {
 *     data: [
 *       { title: '项目A', image: './a.jpg', desc: '描述A' },
 *       { title: '项目B', image: './b.jpg', desc: '描述B' },
 *     ],
 *     radius: 445,
 *     tilt: 22,
 *   });
 */

;(function(global) {
  'use strict';

  /* ============================================
   *  默认配置
   * ============================================ */
  const DEFAULTS = {
    // 卡片数据（必传）
    // 每项: { title: string, image: string, desc?: string }
    data: [],

    // 圆环参数
    radius: 445,          // 圆环半径
    speed: 0.40,          // 滚轮/拖拽旋转速度倍率
    tilt: 22,             // 圆环倾斜角度（度）
    cardRotate: 90,       // 卡片自身旋转角度
    autoSpeed: 0.08,      // 自动旋转速度

    // 卡片尺寸（CSS变量，也支持通过CSS覆盖）
    cardWidth: 120,       // 卡片宽度 (px)
    cardHeight: 160,      // 卡片高度 (px)

    // 详情模式
    detailWidth: 384,     // 详情卡片宽度 (px)
    detailHeight: 528,    // 详情卡片高度 (px)
    detailGap: 56,        // 详情卡片与信息面板间距 (px)
    detailInfoWidth: 340, // 详情信息面板最大宽度 (px)

    // 主题色
    accent: '#4a90d9',

    // 出场动画
    entranceTilt: 80,     // 出场动画起始倾斜角
    entranceDuration: 2.5,// 出场动画卡片增长时长
    tiltDuration: 1.5,    // 出场动画倾斜过渡时长

    // 自动旋转延迟（用户停止操作多久后恢复自动旋转，毫秒）
    autoDelay: 4000,
  };

  /* ============================================
   *  RingCarousel 类
   * ============================================ */
  function RingCarousel(container, options) {
    if (!(this instanceof RingCarousel)) {
      return new RingCarousel(container, options);
    }

    // 解析容器
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      throw new Error('RingCarousel: 找不到容器元素');
    }

    // 合并配置
    this.options = Object.assign({}, DEFAULTS, options);

    if (!this.options.data || this.options.data.length === 0) {
      throw new Error('RingCarousel: data 参数不能为空');
    }

    // 运行时状态
    this._angle = 0;
    this._target = 0;
    this._dragging = false;
    this._dragMoved = false;
    this._cards = [];
    this._activeIdx = -1;
    this._lastTouch = 0;
    this._tiltCur = -this.options.tilt;
    this._mouseTiltX = 0;
    this._mouseTiltY = 0;
    this._mouseInScene = false;
    this._visibleCount = this.options.data.length;
    this._entranceDone = false;
    this._detailMode = false;
    this._detailIdx = 0;
    this._detailTl = null;
    this._imageSizes = {};  // 缓存图片原始尺寸 { url: { w, h } }
    this._tiltXCur = 0;
    this._rafId = null;
    this._destroyed = false;

    // GSAP 插件引用
    this._Observer = null;
    this._Draggable = null;

    // 事件处理器引用（用于销毁时解绑）
    this._boundHandlers = {};

    // 初始化
    this._init();
  }

  /* ============================================
   *  公共方法
   * ============================================ */

  /**
   * 旋转到下一张卡片
   */
  RingCarousel.prototype.next = function() {
    if (this._detailMode) return;
    var step = 360 / this._cards.length;
    this._target += step;
    this._lastTouch = performance.now();
  };

  /**
   * 旋转到上一张卡片
   */
  RingCarousel.prototype.prev = function() {
    if (this._detailMode) return;
    var step = 360 / this._cards.length;
    this._target -= step;
    this._lastTouch = performance.now();
  };

  /**
   * 打开指定卡片的详情
   * @param {number} idx 卡片索引
   */
  RingCarousel.prototype.openDetail = function(idx) {
    if (this._detailMode) return;
    if (idx < 0 || idx >= this._cards.length) return;
    this._openDetail(idx);
  };

  /**
   * 关闭详情
   */
  RingCarousel.prototype.closeDetail = function() {
    if (!this._detailMode) return;
    this._closeDetail();
  };

  /**
   * 获取当前激活的卡片索引
   * @returns {number}
   */
  RingCarousel.prototype.getActiveIndex = function() {
    return this._activeIdx;
  };

  /**
   * 获取当前是否处于详情模式
   * @returns {boolean}
   */
  RingCarousel.prototype.isDetailMode = function() {
    return this._detailMode;
  };

  /**
   * 更新数据（动态增删卡片）
   * @param {Array} newData 新的卡片数据数组
   */
  RingCarousel.prototype.updateData = function(newData) {
    if (!newData || newData.length === 0) return;
    this.options.data = newData;
    this._createCards();
    this._visibleCount = newData.length;
  };

  /**
   * 更新配置参数
   * @param {Object} newConfig 新的配置项（会与当前配置合并）
   */
  RingCarousel.prototype.updateConfig = function(newConfig) {
    Object.assign(this.options, newConfig);
    this._applyCSSVars();
    // 如果卡片数量变了，需要重建
    if (newConfig.cardWidth || newConfig.cardHeight) {
      this._createCards();
    }
  };

  /**
   * 销毁组件，清理所有 DOM、事件和动画
   */
  RingCarousel.prototype.destroy = function() {
    if (this._destroyed) return;
    this._destroyed = true;

    // 停止动画循环
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // 杀死 GSAP 动画
    if (this._detailTl) {
      this._detailTl.kill();
      this._detailTl = null;
    }

    // 解绑事件
    this._unbindEvents();

    // 清空容器
    this.container.innerHTML = '';
    this.container.classList.remove('ring-carousel', 'detail-mode');

    // 清理引用
    this._cards = [];
    this._scene = null;
    this._ring = null;
  };

  /* ============================================
   *  内部方法：初始化
   * ============================================ */

  RingCarousel.prototype._init = function() {
    // 检查 GSAP 依赖
    if (typeof gsap === 'undefined') {
      throw new Error('RingCarousel: 需要先加载 GSAP 库（gsap.min.js）');
    }
    this._Observer = (typeof Observer !== 'undefined') ? Observer : null;
    this._Draggable = (typeof Draggable !== 'undefined') ? Draggable : null;

    // 设置容器
    this.container.classList.add('ring-carousel');
    this._applyCSSVars();

    // 构建 DOM
    this._buildDOM();

    // 创建卡片
    this._createCards();

    // 绑定事件
    this._bindEvents();

    // 启动动画循环
    this._loop();

    // 自动旋转
    this._autoRotate();

    // 出场动画
    this._playEntrance();
  };

  /* ============================================
   *  内部方法：应用 CSS 变量
   * ============================================ */
  RingCarousel.prototype._applyCSSVars = function() {
    var s = this.container.style;
    s.setProperty('--rc-card-w', this.options.cardWidth + 'px');
    s.setProperty('--rc-card-h', this.options.cardHeight + 'px');
    s.setProperty('--rc-accent', this.options.accent);
  };

  /* ============================================
   *  内部方法：构建 DOM 结构
   * ============================================ */
  RingCarousel.prototype._buildDOM = function() {
    var self = this;

    // 3D 场景
    this._scene = this._el('div', 'rc-scene');
    this._ring = this._el('div', 'rc-ring');
    this._scene.appendChild(this._ring);

    // 当前卡片信息面板
    this._infoPanel = this._el('div', 'rc-info-panel');
    this._activeTitleEl = this._el('div', 'rc-active-title');
    this._activeIndexEl = this._el('div', 'rc-active-index');
    this._infoPanel.appendChild(this._activeTitleEl);
    this._infoPanel.appendChild(this._activeIndexEl);

    // 详情遮罩
    this._detailOverlay = this._el('div', 'rc-detail-overlay');

    // 飞出的详情卡片
    this._flyCard = this._el('div', 'rc-fly-card');
    this._flyCardInner = this._el('div', 'rc-fly-card-inner');
    this._flyImg = document.createElement('img');
    this._flyImg.alt = '';
    this._flyCardInner.appendChild(this._flyImg);
    this._flyCard.appendChild(this._flyCardInner);

    // 详情信息面板
    this._detailInfo = this._el('div', 'rc-detail-info');
    var detailInfoInner = this._el('div', 'rc-detail-info-inner');
    this._detailIndexEl = this._el('div', 'rc-detail-index');
    this._detailTitleEl = this._el('div', 'rc-detail-title');
    this._detailDescEl = this._el('div', 'rc-detail-desc');
    detailInfoInner.appendChild(this._detailIndexEl);
    detailInfoInner.appendChild(this._detailTitleEl);
    detailInfoInner.appendChild(this._detailDescEl);
    this._detailInfo.appendChild(detailInfoInner);

    // 底部翻页器
    this._bottomPager = this._el('div', 'rc-bottom-pager');
    this._pagerPrev = this._el('button', 'rc-pager-btn');
    this._pagerPrev.innerHTML = '←';
    this._pagerIndicator = this._el('span', 'rc-pager-indicator');
    this._pagerNext = this._el('button', 'rc-pager-btn');
    this._pagerNext.innerHTML = '→';
    this._pagerClose = this._el('button', 'rc-pager-close');
    this._pagerClose.textContent = '返回圆环';
    this._bottomPager.appendChild(this._pagerPrev);
    this._bottomPager.appendChild(this._pagerIndicator);
    this._bottomPager.appendChild(this._pagerNext);
    this._bottomPager.appendChild(this._pagerClose);

    // 添加到容器
    this.container.appendChild(this._scene);
    this.container.appendChild(this._infoPanel);
    this.container.appendChild(this._detailOverlay);
    this.container.appendChild(this._flyCard);
    this.container.appendChild(this._detailInfo);
    this.container.appendChild(this._bottomPager);
  };

  /* ============================================
   *  内部方法：创建元素辅助函数
   * ============================================ */
  RingCarousel.prototype._el = function(tag, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  };

  /* ============================================
   *  内部方法：创建卡片
   * ============================================ */
  RingCarousel.prototype._createCards = function() {
    this._ring.innerHTML = '';
    this._cards = [];
    var self = this;
    var data = this.options.data;

    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var el = this._el('div', 'rc-card');
      var badgeNum = String(i + 1).padStart(2, '0');
      el.innerHTML =
        '<div class="rc-card-inner">' +
          '<img data-src="' + (d.image || '') + '" alt="' + (d.title || '') + '">' +
          '<div class="rc-card-title">' + (d.title || '') + '</div>' +
          '<span class="cw-badge" data-badge="' + badgeNum + '">' + badgeNum + '</span>' +
        '</div>';
      this._ring.appendChild(el);
      this._cards.push(el);

      // 图片加载
      var img = el.querySelector('img');
      img.addEventListener('load', function() { this.classList.add('loaded'); });

      // 点击事件（用闭包保留索引）
      (function(index) {
        el.addEventListener('click', function() {
          if (!self._dragMoved) self._clickCard(index);
        });
      })(i);
    }

    // 延迟加载图片
    setTimeout(function() {
      self._ring.querySelectorAll('.rc-card-inner img[data-src]').forEach(function(img) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }, 1500);
  };

  /* ============================================
   *  内部方法：更新卡片位置
   * ============================================ */
  RingCarousel.prototype._updateCards = function() {
    var n = this._cards.length;
    var step = 360 / n;
    var R = this.options.radius;
    var closestIdx = 0;
    var maxZ = -Infinity;

    for (var i = 0; i < n; i++) {
      var card = this._cards[i];

      // 出场动画期间：超出 visibleCount 的卡片隐藏
      if (i >= this._visibleCount) {
        card.style.opacity = 0;
        card.style.transform = 'rotateY(' + (step * i + this._angle) + 'deg) translateZ(0px)';
        card.style.zIndex = -1;
        continue;
      }

      var deg = step * i + this._angle;
      card.style.transform = 'rotateY(' + deg + 'deg) translateZ(' + R + 'px) rotateY(' + this.options.cardRotate + 'deg)';

      var rad = deg * Math.PI / 180;
      var worldZ = Math.cos(rad) * R;
      var depthFactor = (worldZ + R) / (2 * R);
      var opacity = 0.12 + depthFactor * 0.88;
      card.style.opacity = opacity;
      card.style.zIndex = Math.round(depthFactor * 100);

      if (worldZ > maxZ) {
        maxZ = worldZ;
        closestIdx = i;
      }
    }

    if (!this._detailMode) this._updateActive(closestIdx);
  };

  /* ============================================
   *  内部方法：更新当前激活卡片
   * ============================================ */
  RingCarousel.prototype._updateActive = function(idx) {
    if (this._activeIdx !== idx) {
      if (this._activeIdx >= 0 && this._cards[this._activeIdx]) {
        this._cards[this._activeIdx].classList.remove('active');
      }
      if (this._cards[idx]) this._cards[idx].classList.add('active');
      this._activeIdx = idx;

      var d = this.options.data[idx] || {};
      this._activeTitleEl.textContent = d.title || '';
      this._activeTitleEl.classList.add('visible');
      this._activeIndexEl.textContent =
        String(idx + 1).padStart(2, '0') + ' / ' + String(this._cards.length).padStart(2, '0');
    }
  };

  /* ============================================
   *  内部方法：点击卡片
   * ============================================ */
  RingCarousel.prototype._clickCard = function(idx) {
    if (this._detailMode) return;
    this._openDetail(idx);
  };

  /* ============================================
   *  内部方法：获取图片原始尺寸（带缓存）
   * ============================================ */
  RingCarousel.prototype._getImageSize = function(url, callback) {
    if (!url) {
      callback(this.options.detailWidth, this.options.detailHeight);
      return;
    }
    // 命中缓存
    if (this._imageSizes[url]) {
      callback(this._imageSizes[url].w, this._imageSizes[url].h);
      return;
    }
    var self = this;
    var img = new Image();
    img.onload = function() {
      self._imageSizes[url] = { w: img.naturalWidth, h: img.naturalHeight };
      callback(img.naturalWidth, img.naturalHeight);
    };
    img.onerror = function() {
      callback(self.options.detailWidth, self.options.detailHeight);
    };
    img.src = url;
  };

  /* ============================================
   *  内部方法：根据图片原始比例计算详情卡片尺寸
   *  在最大可用区域内，保持图片原始宽高比，不压缩像素
   * ============================================ */
  RingCarousel.prototype._calcDetailSize = function(imgW, imgH) {
    var cw = this.container.clientWidth;
    var ch = this.container.clientHeight;
    var GAP = this.options.detailGap;
    var INFO_W = this.options.detailInfoWidth;

    // 详情卡片可用的最大区域：容器宽度减去信息面板和间距
    var maxW = cw - INFO_W - GAP - 80;  // 左右各留40px
    var maxH = ch - 160;  // 上下各留80px

    // 限制不超过图片原始尺寸（不放大超过原始像素）
    maxW = Math.min(maxW, imgW);
    maxH = Math.min(maxH, imgH);

    var ratio = imgW / imgH;
    var detailW, detailH;

    if (maxW / maxH > ratio) {
      // 高度受限
      detailH = maxH;
      detailW = maxH * ratio;
    } else {
      // 宽度受限
      detailW = maxW;
      detailH = maxW / ratio;
    }

    return { w: Math.round(detailW), h: Math.round(detailH) };
  };

  /* ============================================
   *  内部方法：打开详情
   * ============================================ */
  RingCarousel.prototype._openDetail = function(idx) {
    var self = this;
    this._detailMode = true;
    this._detailIdx = idx;
    this.container.classList.add('detail-mode');

    var d = this.options.data[idx] || {};
    var cardEl = this._cards[idx];
    var cardRect = cardEl.getBoundingClientRect();
    var containerRect = this.container.getBoundingClientRect();

    // 隐藏圆环中的卡片（视觉上"飞出去了"）
    cardEl.classList.add('detached');

    // 飞出卡片初始位置 = 圆环卡片的相对位置
    var startLeft = cardRect.left - containerRect.left;
    var startTop = cardRect.top - containerRect.top;
    var startW = cardRect.width;
    var startH = cardRect.height;

    // 获取图片原始尺寸后计算详情卡片大小
    this._getImageSize(d.image, function(imgW, imgH) {
      var size = self._calcDetailSize(imgW, imgH);
      var DETAIL_W = size.w;
      var DETAIL_H = size.h;

      // 计算居中布局
      var cw = self.container.clientWidth;
      var ch = self.container.clientHeight;
      var GAP = self.options.detailGap;
      var INFO_W = self.options.detailInfoWidth;
      var totalW = DETAIL_W + GAP + INFO_W;
      var groupLeft = (cw - totalW) / 2;
      var endLeft = groupLeft;
      var endTop = ch * 0.5 - DETAIL_H / 2;
      var infoLeft = groupLeft + DETAIL_W + GAP;
      var infoTop = ch * 0.5 - 100;

      // 设置详情卡片图片（使用原始图片URL，不拼接尺寸）
      self._flyImg.src = d.image || '';

      // 初始化飞出卡片
      gsap.set(self._flyCard, {
        left: startLeft,
        top: startTop,
        width: startW,
        height: startH,
        opacity: 1,
      });
      self._flyCard.classList.add('active');

      // 初始化信息面板
      gsap.set(self._detailInfo, {
        left: infoLeft,
        top: infoTop,
        opacity: 0,
      });
      self._detailInfo.classList.add('active');

      // 更新详情内容
      self._detailIndexEl.textContent =
        String(idx + 1).padStart(2, '0') + ' / ' + String(self._cards.length).padStart(2, '0');
      self._detailTitleEl.textContent = d.title || '';
      self._detailDescEl.textContent = d.desc || '暂无详细描述';
      self._pagerIndicator.textContent = (idx + 1) + ' / ' + self._cards.length;

      // 激活遮罩和翻页器
      self._detailOverlay.classList.add('active');
      self._bottomPager.classList.add('active');

      // GSAP 动画时间线
      if (self._detailTl) self._detailTl.kill();
      self._detailTl = gsap.timeline();

      // 飞出卡片飞到目标位置
      self._detailTl.to(self._flyCard, {
        left: endLeft,
        top: endTop,
        width: DETAIL_W,
        height: DETAIL_H,
        duration: 0.7,
        ease: 'power2.out',
      }, 0);

      // 信息面板淡入
      self._detailTl.to(self._detailInfo, {
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out',
      }, 0.25);

      // 内容逐个出现
      self._detailTl.from(self._detailIndexEl, { y: 10, opacity: 0, duration: 0.3, ease: 'power2.out' }, 0.3);
      self._detailTl.from(self._detailTitleEl, { y: 15, opacity: 0, duration: 0.4, ease: 'power2.out' }, 0.35);
      self._detailTl.from(self._detailDescEl, { y: 15, opacity: 0, duration: 0.4, ease: 'power2.out' }, 0.45);
    });
  };

  /* ============================================
   *  内部方法：关闭详情
   * ============================================ */
  RingCarousel.prototype._closeDetail = function() {
    var self = this;
    var cardEl = this._cards[this._detailIdx];
    var cardRect = cardEl.getBoundingClientRect();
    var containerRect = this.container.getBoundingClientRect();

    var targetLeft = cardRect.left - containerRect.left;
    var targetTop = cardRect.top - containerRect.top;
    var targetW = cardRect.width;
    var targetH = cardRect.height;

    if (this._detailTl) this._detailTl.kill();
    this._detailTl = gsap.timeline({
      onComplete: function() {
        self._detailMode = false;
        self.container.classList.remove('detail-mode');
        self._flyCard.classList.remove('active');
        self._detailInfo.classList.remove('active');
        cardEl.classList.remove('detached');
        gsap.set(self._flyCard, { opacity: 0 });
        gsap.set(self._detailInfo, { opacity: 0 });
      }
    });

    // 信息面板淡出
    this._detailTl.to(this._detailInfo, {
      opacity: 0,
      duration: 0.35,
      ease: 'power2.in',
    }, 0);

    // 飞出卡片飞回
    this._detailTl.to(this._flyCard, {
      left: targetLeft,
      top: targetTop,
      width: targetW,
      height: targetH,
      opacity: 0,
      duration: 0.55,
      ease: 'power2.inOut',
    }, 0.05);

    // 遮罩和翻页器淡出
    this._detailTl.add(function() {
      self._detailOverlay.classList.remove('active');
      self._bottomPager.classList.remove('active');
    }, 0.15);

    // 提前恢复圆环卡片（过渡无缝）
    this._detailTl.add(function() {
      cardEl.classList.remove('detached');
    }, 0.4);
  };

  /* ============================================
   *  内部方法：详情翻页
   * ============================================ */
  RingCarousel.prototype._detailNavigate = function(dir) {
    if (!this._detailMode) return;

    var self = this;
    var n = this._cards.length;
    var newIdx = ((this._detailIdx + dir) % n + n) % n;

    // 静默旋转圆环
    var step = 360 / n;
    var dest = -step * newIdx;
    var diff = dest - this._angle;
    diff = ((diff + 180) % 360 + 360) % 360 - 180;
    this._target = this._angle + diff;
    this._angle = this._target;

    // 恢复旧卡片，隐藏新卡片
    this._cards[this._detailIdx].classList.remove('detached');
    this._cards[newIdx].classList.add('detached');

    var d = this.options.data[newIdx] || {};
    var cw = this.container.clientWidth;
    var ch = this.container.clientHeight;

    // 获取新卡片的图片原始尺寸
    this._getImageSize(d.image, function(imgW, imgH) {
      var size = self._calcDetailSize(imgW, imgH);
      var DETAIL_W = size.w;
      var DETAIL_H = size.h;

      var GAP = self.options.detailGap;
      var INFO_W = self.options.detailInfoWidth;
      var totalW = DETAIL_W + GAP + INFO_W;
      var groupLeft = (cw - totalW) / 2;
      var endLeft = groupLeft;
      var endTop = ch * 0.5 - DETAIL_H / 2;

      if (self._detailTl) self._detailTl.kill();
      self._detailTl = gsap.timeline({
        onComplete: function() {
          self._detailIdx = newIdx;
        }
      });

      // 当前卡片滑出
      self._detailTl.to(self._flyCard, {
        left: dir > 0 ? -DETAIL_W - 50 : cw + 50,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
      }, 0);

      // 信息面板淡出
      self._detailTl.to(self._detailInfo, {
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
      }, 0);

      // 更新内容 + 从反方向滑入
      self._detailTl.add(function() {
        self._flyImg.src = d.image || '';
        self._detailIndexEl.textContent =
          String(newIdx + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
        self._detailTitleEl.textContent = d.title || '';
        self._detailDescEl.textContent = d.desc || '暂无详细描述';
        self._pagerIndicator.textContent = (newIdx + 1) + ' / ' + n;

        gsap.set(self._flyCard, {
          left: dir > 0 ? cw + 50 : -DETAIL_W - 50,
          top: endTop,
          width: DETAIL_W,
          height: DETAIL_H,
          opacity: 0,
        });
        gsap.set(self._detailInfo, { opacity: 0 });
      }, 0.3);

      // 新卡片滑入
      self._detailTl.to(self._flyCard, {
        left: endLeft,
        top: endTop,
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out',
      }, 0.35);

      // 信息面板淡入
      self._detailTl.to(self._detailInfo, {
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
      }, 0.45);

      self._detailTl.from(self._detailIndexEl, { y: 8, opacity: 0, duration: 0.25, ease: 'power2.out' }, 0.45);
      self._detailTl.from(self._detailTitleEl, { y: 10, opacity: 0, duration: 0.3, ease: 'power2.out' }, 0.5);
      self._detailTl.from(self._detailDescEl, { y: 10, opacity: 0, duration: 0.3, ease: 'power2.out' }, 0.58);
    });
  };

  /* ============================================
   *  内部方法：绑定事件
   * ============================================ */
  RingCarousel.prototype._bindEvents = function() {
    var self = this;

    // --- 滚轮 ---
    if (this._Observer) {
      this._observerInstance = Observer.create({
        target: this._scene,
        type: 'wheel',
        onWheel: function(e) {
          if (self._detailMode) return;
          self._target += (e.deltaY || e.deltaX) * self.options.speed * 0.08;
          self._lastTouch = performance.now();
        }
      });
    }

    // --- 拖拽 ---
    if (this._Draggable) {
      var startA = 0, startX = 0;
      this._dragProxy = document.createElement('div');
      this._draggableInstance = Draggable.create(this._dragProxy, {
        trigger: this._scene,
        type: 'x',
        minimumMovement: 2,
        onDragStart: function() {
          if (self._detailMode) return;
          self._dragging = true;
          self._dragMoved = false;
          startA = self._angle;
          startX = this.x;
          self._lastTouch = performance.now();
        },
        onDrag: function() {
          if (self._detailMode) return;
          self._dragMoved = true;
          self._target = startA + (this.x - startX) * 0.2;
          self._lastTouch = performance.now();
        },
        onDragEnd: function() {
          self._dragging = false;
          setTimeout(function() { self._dragMoved = false; }, 50);
        },
      })[0];
    }

    // --- 鼠标跟随倾斜 ---
    this._boundHandlers.mousemove = function(e) {
      if (self._detailMode) return;
      self._mouseInScene = true;
      var rect = self._scene.getBoundingClientRect();
      var nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      var ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      self._mouseTiltX = -nx * 8;
      self._mouseTiltY = ny * 8;
    };
    this._boundHandlers.mouseleave = function() {
      self._mouseInScene = false;
      self._mouseTiltX = 0;
      self._mouseTiltY = 0;
    };
    this._scene.addEventListener('mousemove', this._boundHandlers.mousemove);
    this._scene.addEventListener('mouseleave', this._boundHandlers.mouseleave);

    // --- 键盘 ---
    this._boundHandlers.keydown = function(e) {
      if (self._detailMode) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') self._detailNavigate(-1);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') self._detailNavigate(1);
        if (e.key === 'Escape') self._closeDetail();
        return;
      }
      var step = 360 / self._cards.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { self._target -= step; self._lastTouch = performance.now(); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { self._target += step; self._lastTouch = performance.now(); }
    };
    document.addEventListener('keydown', this._boundHandlers.keydown);

    // --- 触摸 ---
    var tx = 0, ta = 0;
    this._boundHandlers.touchstart = function(e) {
      if (self._detailMode) return;
      tx = e.touches[0].clientX; ta = self._angle;
      self._dragging = true; self._dragMoved = false;
      self._lastTouch = performance.now();
    };
    this._boundHandlers.touchmove = function(e) {
      if (self._detailMode) return;
      self._dragMoved = true;
      self._target = ta + (e.touches[0].clientX - tx) * 0.2;
      self._lastTouch = performance.now();
    };
    this._boundHandlers.touchend = function() {
      self._dragging = false;
      setTimeout(function() { self._dragMoved = false; }, 50);
    };
    this._scene.addEventListener('touchstart', this._boundHandlers.touchstart, { passive: true });
    this._scene.addEventListener('touchmove', this._boundHandlers.touchmove, { passive: true });
    this._scene.addEventListener('touchend', this._boundHandlers.touchend);

    // --- 详情模式事件 ---
    this._boundHandlers.overlayClick = function(e) {
      if (e.target === self._detailOverlay) self._closeDetail();
    };
    this._detailOverlay.addEventListener('click', this._boundHandlers.overlayClick);

    this._boundHandlers.flyCardClick = function(e) { e.stopPropagation(); };
    this._flyCard.addEventListener('click', this._boundHandlers.flyCardClick);

    this._boundHandlers.detailInfoClick = function(e) { e.stopPropagation(); };
    this._detailInfo.addEventListener('click', this._boundHandlers.detailInfoClick);

    this._boundHandlers.pagerPrevClick = function(e) { e.stopPropagation(); self._detailNavigate(-1); };
    this._boundHandlers.pagerNextClick = function(e) { e.stopPropagation(); self._detailNavigate(1); };
    this._boundHandlers.pagerCloseClick = function(e) { e.stopPropagation(); self._closeDetail(); };
    this._pagerPrev.addEventListener('click', this._boundHandlers.pagerPrevClick);
    this._pagerNext.addEventListener('click', this._boundHandlers.pagerNextClick);
    this._pagerClose.addEventListener('click', this._boundHandlers.pagerCloseClick);
  };

  /* ============================================
   *  内部方法：解绑事件
   * ============================================ */
  RingCarousel.prototype._unbindEvents = function() {
    var bh = this._boundHandlers;

    // GSAP Observer
    if (this._observerInstance) {
      this._observerInstance.kill();
      this._observerInstance = null;
    }

    // GSAP Draggable
    if (this._draggableInstance) {
      this._draggableInstance.kill();
      this._draggableInstance = null;
    }

    // 鼠标事件
    if (this._scene) {
      this._scene.removeEventListener('mousemove', bh.mousemove);
      this._scene.removeEventListener('mouseleave', bh.mouseleave);
      this._scene.removeEventListener('touchstart', bh.touchstart);
      this._scene.removeEventListener('touchmove', bh.touchmove);
      this._scene.removeEventListener('touchend', bh.touchend);
    }

    // 键盘
    document.removeEventListener('keydown', bh.keydown);

    // 详情模式
    if (this._detailOverlay) this._detailOverlay.removeEventListener('click', bh.overlayClick);
    if (this._flyCard) this._flyCard.removeEventListener('click', bh.flyCardClick);
    if (this._detailInfo) this._detailInfo.removeEventListener('click', bh.detailInfoClick);
    if (this._pagerPrev) this._pagerPrev.removeEventListener('click', bh.pagerPrevClick);
    if (this._pagerNext) this._pagerNext.removeEventListener('click', bh.pagerNextClick);
    if (this._pagerClose) this._pagerClose.removeEventListener('click', bh.pagerCloseClick);
  };

  /* ============================================
   *  内部方法：动画主循环
   * ============================================ */
  RingCarousel.prototype._loop = function() {
    if (this._destroyed) return;
    var self = this;

    this._angle += (this._target - this._angle) * 0.06;

    var targetTilt = -this.options.tilt + (this._detailMode ? 0 : this._mouseTiltY);
    this._tiltCur += (targetTilt - this._tiltCur) * 0.04;
    this._tiltXCur += ((this._detailMode ? 0 : this._mouseTiltX) - this._tiltXCur) * 0.04;
    this._ring.style.transform = 'rotateX(' + this._tiltCur + 'deg) rotateY(' + this._tiltXCur + 'deg)';

    this._updateCards();

    this._rafId = requestAnimationFrame(function() { self._loop(); });
  };

  /* ============================================
   *  内部方法：自动旋转
   * ============================================ */
  RingCarousel.prototype._autoRotate = function() {
    var self = this;
    var last = performance.now();

    (function tick(now) {
      if (self._destroyed) return;
      var dt = (now - last) / 1000;
      last = now;
      if (!self._dragging && !self._detailMode && now - self._lastTouch > self.options.autoDelay) {
        self._target += self.options.autoSpeed * dt * 8;
      }
      requestAnimationFrame(tick);
    })(performance.now());
  };

  /* ============================================
   *  内部方法：出场动画
   * ============================================ */
  RingCarousel.prototype._playEntrance = function() {
    var self = this;
    var targetTilt = this.options.tilt;
    var targetCount = this.options.data.length;

    this.options.tilt = this.options.entranceTilt;
    this._tiltCur = -this.options.entranceTilt;
    this._visibleCount = 1;

    var tl = gsap.timeline({
      onComplete: function() {
        self._entranceDone = true;
      }
    });

    tl.to({ v: 1 }, {
      v: targetCount,
      duration: this.options.entranceDuration,
      ease: 'power1.out',
      onUpdate: function() {
        self._visibleCount = Math.round(this.targets()[0].v);
      }
    });

    tl.to({ tilt: -this.options.entranceTilt }, {
      tilt: -targetTilt,
      duration: this.options.tiltDuration,
      ease: 'power2.inOut',
      onUpdate: function() {
        self.options.tilt = -this.targets()[0].tilt;
      }
    }, '-=0.5');
  };

  /* ============================================
   *  暴露到全局
   * ============================================ */
  global.RingCarousel = RingCarousel;

})(typeof window !== 'undefined' ? window : this);
