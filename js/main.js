import { updateTime } from './time.js';
import { initRipples, startRipplePlugin } from './ripple.js';

/**
 * 判断水波纹所需的外部依赖是否可用。
 *
 * @returns {boolean} jQuery 和水波纹插件均可用时返回 true，否则返回 false。
 * @note 此检查用于在 CDN 不可用时安全降级为静态背景。
 */
function isRippleAvailable() {
    return typeof window.jQuery !== 'undefined'
        && typeof window.jQuery.fn?.ripples === 'function';
}

/**
 * 初始化实时时钟。
 *
 * @returns {void}
 * @note 创建一个每秒执行的定时器，用于持续刷新页面时间。
 */
function initClock() {
    updateTime();
    window.setInterval(updateTime, 1000);
}

/**
 * 初始化可选的水波纹增强效果。
 *
 * @returns {void}
 * @note 外部 CDN 不可用时保留 CSS 静态背景，不影响其他页面功能。
 */
function initRippleEffect() {
    if (!isRippleAvailable()) {
        console.warn('水波纹依赖不可用，已自动使用静态背景。');
        return;
    }

    initRipples();

    window.addEventListener('resize', () => {
        const rippleContainer = document.getElementById('ripple-container');
        if (rippleContainer
            && isRippleAvailable()
            && window.jQuery(rippleContainer).data('ripples')) {
            startRipplePlugin(rippleContainer);
        }
    });
}

/**
 * 阻止社交链接的点击事件继续传播。
 *
 * @returns {void}
 * @note 避免点击链接时同时触发背景水波纹。
 */
function bindSocialLinkEvents() {
    document.querySelectorAll('.social-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
}

/**
 * 初始化页面的核心功能和可选视觉效果。
 *
 * @returns {void}
 * @note 核心功能先初始化，水波纹依赖失败不会中止后续流程。
 */
function init() {
    initClock();
    bindSocialLinkEvents();
    initRippleEffect();
}

window.addEventListener('load', init);
