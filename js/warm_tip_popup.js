// warm-tip-popup.js - 温馨提示弹窗核心逻辑（无依赖纯JS版）
class WarmTipPopup {
  constructor() {
    // 配置项（可根据网站需求修改）
    this.config = {
      tips: [
        '多喝水哦~', '保持微笑呀', '每天都要元气满满',
        '记得吃水果', '保持好心情', '好好爱自己', '我想你了',
        '梦想成真', '期待下一次见面', '金榜题名',
        '顺顺利利', '早点休息', '愿所有烦恼都消失',
        '别熬夜', '今天过得开心嘛', '天冷了，多穿衣服'
      ],
      bgColors: [
        'lightpink', 'skyblue', 'lightgreen', 'lavender',
        'lightyellow', 'plum', 'coral', 'bisque', 'aquamarine',
        'mistyrose', 'honeydew', 'lavenderblush', 'oldlace'
      ],
      maxPopup: 400, // 最大弹窗数（避免卡顿）
      popupInterval: 100, // 弹窗间隔（毫秒，越小越快）
      boxWidth: 220, // 弹窗宽度
      boxHeight: 80, // 弹窗高度
      zIndex: 9999 // 弹窗层级（避免被网站元素覆盖）
    };

    // 全局状态
    this.popupTimer = null;
    this.popupCount = 0;

    // 初始化：动态注入CSS（仅注入一次）
    this.injectStyles();
  }

  // 动态注入弹窗样式（无需外部CSS文件）
  injectStyles() {
    if (document.getElementById('warm-tip-styles')) return; // 避免重复注入
    const style = document.createElement('style');
    style.id = 'warm-tip-styles';
    style.textContent = `
      .warm-tip-box {
        position: fixed;
        padding: 20px 30px;
        border-radius: 12px;
        font-family: "微软雅黑", sans-serif;
        font-size: 18px;
        color: #333;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        cursor: move;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        pointer-events: auto; /* 确保可拖动、不影响网站其他元素 */
      }
    `;
    document.head.appendChild(style);
  }

  // 创建单个弹窗
  createSinglePopup() {
    const { tips, bgColors, boxWidth, boxHeight, zIndex } = this.config;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // 随机位置（避免超出屏幕）
    const randomX = Math.floor(Math.random() * (screenWidth - boxWidth));
    const randomY = Math.floor(Math.random() * (screenHeight - boxHeight));

    // 随机文字和背景色
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    const randomBg = bgColors[Math.floor(Math.random() * bgColors.length)];

    // 创建弹窗元素
    const popup = document.createElement('div');
    popup.className = 'warm-tip-box';
    popup.style.left = `${randomX}px`;
    popup.style.top = `${randomY}px`;
    popup.style.width = `${boxWidth}px`;
    popup.style.height = `${boxHeight}px`;
    popup.style.backgroundColor = randomBg;
    popup.style.zIndex = zIndex;
    popup.textContent = randomTip;

    // 拖动功能
    let isDragging = false;
    let startX, startY;
    popup.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX - popup.offsetLeft;
      startY = e.clientY - popup.offsetTop;
      popup.style.zIndex = zIndex + 1; // 拖动时层级提升
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      let newX = e.clientX - startX;
      let newY = e.clientY - startY;
      // 限制边界
      newX = Math.max(0, Math.min(newX, screenWidth - boxWidth));
      newY = Math.max(0, Math.min(newY, screenHeight - boxHeight));
      popup.style.left = `${newX}px`;
      popup.style.top = `${newY}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        popup.style.zIndex = zIndex; // 恢复层级
      }
    });

    document.body.appendChild(popup);
    this.popupCount++;

    // 达到最大数量自动停止
    if (this.popupCount >= this.config.maxPopup) {
      this.stopPopup();
    }
  }

  // 开始批量弹出
  startPopup() {
    if (this.popupTimer) return;
    this.popupTimer = setInterval(() => this.createSinglePopup(), this.config.popupInterval);
  }

  // 停止弹出
  stopPopup() {
    if (this.popupTimer) {
      clearInterval(this.popupTimer);
      this.popupTimer = null;
    }
  }

  // 清空所有弹窗
  clearAllPopups() {
    this.stopPopup();
    const allPopups = document.querySelectorAll('.warm-tip-box');
    allPopups.forEach(popup => {
      popup.style.opacity = 0;
      setTimeout(() => popup.remove(), 300);
    });
    this.popupCount = 0;
  }

  // 自定义配置（动态修改参数）
  setConfig(customConfig) {
    this.config = { ...this.config, ...customConfig };
  }
}

// 初始化实例（全局可访问）
window.addEventListener('load', () => {
  window.warmTipPopup = new WarmTipPopup();
});