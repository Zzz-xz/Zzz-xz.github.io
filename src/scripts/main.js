import { startClock } from './time.js';

/**
 * 判断水波纹所需的本地依赖是否可用。
 *
 * @returns {boolean} jQuery 和水波纹插件均可用时返回 true，否则返回 false。
 * @note 依赖异常时安全降级为静态背景。
 */
function isRippleAvailable() {
    return typeof window.jQuery !== 'undefined'
        && typeof window.jQuery.fn?.ripples === 'function';
}

/**
 * 初始化可选的水波纹增强效果。
 *
 * @returns {Promise<void>}
 * @note 本地依赖不可用时保留 CSS 静态背景，不影响其他页面功能。
 */
async function initRippleEffect() {
    if (!isRippleAvailable()) {
        console.warn('水波纹依赖不可用，已自动使用静态背景。');
        return;
    }

    try {
        const { initRipples } = await import('./ripple.js');
        initRipples();
    } catch (error) {
        console.error('水波纹模块加载失败：', error);
        console.warn('已自动使用静态背景，页面其他功能不受影响。');
    }
}

/**
 * 立即初始化核心功能，并在页面资源就绪后启动可选视觉效果。
 *
 * @returns {void}
 * @note 时钟不等待图片、字体或水波纹依赖，避免慢资源阻塞时间显示。
 */
function init() {
    startClock();

    if (document.readyState === 'complete') {
        initRippleEffect();
        return;
    }

    window.addEventListener('load', initRippleEffect, { once: true });
}

init();
