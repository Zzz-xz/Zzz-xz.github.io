/** 水波纹效果参数。 */
export const RIPPLE_CONFIG = {
    resolution: 384,
    dropRadius: 9,
    perturbance: 0.012,
    minRippleInterval: 42,
    minRadius: 0.002,
    maxRadius: 0.026,
    autoRippleRadius: 7,
    autoRippleInterval: 6500,
    autoPerturbance: 0.04,
    clickIntensity: 1.25,
    mouseStaticDelay: 1200,
    backgroundImage: 'assets/images/background.jpg'
};

/** 水波纹运行状态。 */
let autoRippleTimer = null;
let isMouseMoving = false;
let mouseStaticTimer = null;
let lastRippleTime = 0;
let interactionEventsBound = false;
let visibilityEventsBound = false;

/**
 * 判断用户是否要求减少动态效果。
 *
 * @returns {boolean} 系统启用减少动态效果时返回 true。
 */
function prefersReducedMotion() {
    return typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 获取已经初始化水波纹插件的 jQuery 元素。
 *
 * @param {HTMLElement} container 水波纹容器。
 * @returns {Object|null} 插件可用时返回 jQuery 元素，否则返回 null。
 */
function getRippleElement(container) {
    if (!container || typeof window.jQuery !== 'function') return null;

    const rippleElement = window.jQuery(container);
    return rippleElement.data('ripples') ? rippleElement : null;
}

/**
 * 停止自动水波纹定时器。
 *
 * @returns {void}
 */
function stopAutoRipples() {
    if (autoRippleTimer === null) return;

    window.clearTimeout(autoRippleTimer);
    autoRippleTimer = null;
}

/**
 * 清除鼠标静止后的恢复定时器。
 *
 * @returns {void}
 */
function clearMouseStaticTimer() {
    if (mouseStaticTimer === null) return;

    window.clearTimeout(mouseStaticTimer);
    mouseStaticTimer = null;
}

/**
 * 获取鼠标或触摸点相对于视口的位置。
 *
 * @param {MouseEvent|TouchEvent} e 指针事件。
 * @param {boolean} isTouch 是否为触摸事件。
 * @returns {{x: number, y: number}} 指针坐标。
 */
function getPointerPosition(e, isTouch) {
    if (isTouch && e.touches && e.touches[0]) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

/**
 * 预加载水波纹背景图片。
 *
 * @param {string} url 图片地址。
 * @param {Function} onSuccess 加载成功回调。
 * @param {Function} onError 加载失败回调。
 * @returns {void}
 */
function preloadImage(url, onSuccess, onError) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = onSuccess;
    img.onerror = onError;
    img.src = url;
}

/**
 * 初始化水波纹插件实例。
 *
 * @param {HTMLElement} container 水波纹容器。
 * @returns {void}
 * @note 已有实例会先销毁；减少动态效果开启时保持静态背景。
 */
export function startRipplePlugin(container) {
    if (!container || prefersReducedMotion()) return;

    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    const rippleElement = window.jQuery(container);

    /** 避免重复实例叠加 WebGL 画布。 */
    if (rippleElement.data('ripples')) {
        try {
            rippleElement.ripples('destroy');
        } catch (e) {
            console.error('销毁旧波纹实例失败:', e);
        }
    }

    try {
        rippleElement.ripples({
            resolution: RIPPLE_CONFIG.resolution,
            dropRadius: RIPPLE_CONFIG.dropRadius,
            perturbance: RIPPLE_CONFIG.perturbance,
            interactive: false,
            crossOrigin: 'anonymous'
        });
    } catch (e) {
        console.error('水波纹初始化失败:', e);
        console.warn('已自动使用静态背景，页面其他功能不受影响。');
    }
}

/**
 * 绑定鼠标与触摸交互事件。
 *
 * @param {HTMLElement} container 水波纹容器。
 * @returns {void}
 * @note 事件只绑定一次，防止重复触发水波。
 */
function bindInteractionEvents(container) {
    if (interactionEventsBound) return;

    container.addEventListener('mousemove', (e) => {
        handleContinuousRipple(e, container, false);
    });

    container.addEventListener('click', (e) => {
        handleSingleRipple(e, container, false);
    });

    container.addEventListener('touchmove', (e) => {
        e.preventDefault();
        handleContinuousRipple(e, container, true);
    }, { passive: false });

    container.addEventListener('touchstart', (e) => {
        handleSingleRipple(e, container, true);
    }, { passive: true });

    interactionEventsBound = true;
}

/**
 * 处理鼠标或触摸移动产生的连续波纹。
 *
 * @param {MouseEvent|TouchEvent} e 指针事件。
 * @param {HTMLElement} container 水波纹容器。
 * @param {boolean} isTouch 是否为触摸事件。
 * @returns {void}
 */
function handleContinuousRipple(e, container, isTouch) {
    if (document.hidden || prefersReducedMotion()) return;

    isMouseMoving = true;
    stopAutoRipples();
    clearMouseStaticTimer();

    mouseStaticTimer = window.setTimeout(() => {
        mouseStaticTimer = null;
        isMouseMoving = false;
        startAutoRipples(container);
    }, RIPPLE_CONFIG.mouseStaticDelay);

    const now = Date.now();
    if (now - lastRippleTime < RIPPLE_CONFIG.minRippleInterval) return;

    const { x, y } = getPointerPosition(e, isTouch);
    const radius = RIPPLE_CONFIG.minRadius + Math.random() * (RIPPLE_CONFIG.maxRadius - RIPPLE_CONFIG.minRadius);
    const rippleElement = getRippleElement(container);
    if (!rippleElement) return;

    rippleElement.ripples('drop', x, y, radius, RIPPLE_CONFIG.perturbance * 0.75);

    lastRippleTime = now;
}

/**
 * 处理点击或触摸产生的单次波纹。
 *
 * @param {MouseEvent|TouchEvent} e 指针事件。
 * @param {HTMLElement} container 水波纹容器。
 * @param {boolean} isTouch 是否为触摸事件。
 * @returns {void}
 */
function handleSingleRipple(e, container, isTouch) {
    if (prefersReducedMotion()) return;

    const rippleElement = getRippleElement(container);
    if (!rippleElement) return;

    const { x, y } = getPointerPosition(e, isTouch);
    const radius = RIPPLE_CONFIG.dropRadius * RIPPLE_CONFIG.clickIntensity;
    const perturbance = RIPPLE_CONFIG.perturbance * RIPPLE_CONFIG.clickIntensity;
    rippleElement.ripples('drop', x, y, radius, perturbance);
}

/**
 * 安排下一次自动水波纹。
 *
 * @param {HTMLElement} container 水波纹容器。
 * @returns {void}
 * @note 使用单次定时器，避免后台标签页恢复时积累多个波纹任务。
 */
export function startAutoRipples(container) {
    if (document.hidden || isMouseMoving || autoRippleTimer !== null || prefersReducedMotion()) return;

    if (!getRippleElement(container)) return;

    autoRippleTimer = window.setTimeout(() => {
        autoRippleTimer = null;

        if (document.hidden || isMouseMoving) return;

        const rippleElement = getRippleElement(container);
        if (!rippleElement) return;

        const containerRect = container.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) {
            startAutoRipples(container);
            return;
        }

        const randomX = Math.random() * containerRect.width;
        const randomY = Math.random() * containerRect.height;
        const randomRadius = RIPPLE_CONFIG.autoRippleRadius + (Math.random() - 0.5) * 2;

        rippleElement.ripples('drop', randomX, randomY, randomRadius, RIPPLE_CONFIG.autoPerturbance);
        startAutoRipples(container);
    }, RIPPLE_CONFIG.autoRippleInterval);
}

/**
 * 绑定页面可见性变化事件。
 *
 * @param {HTMLElement} container 水波纹容器。
 * @returns {void}
 * @note 页面隐藏时暂停模拟，恢复后等待完整间隔再生成新波纹。
 */
function bindVisibilityEvents(container) {
    if (visibilityEventsBound) return;

    document.addEventListener('visibilitychange', () => {
        stopAutoRipples();
        clearMouseStaticTimer();
        isMouseMoving = false;

        const rippleElement = getRippleElement(container);
        if (!rippleElement) return;

        try {
            rippleElement.ripples(document.hidden ? 'pause' : 'play');
        } catch (e) {
            console.warn('切换水波纹运行状态失败:', e);
        }

        if (!document.hidden) {
            lastRippleTime = Date.now();
            startAutoRipples(container);
        }
    });

    visibilityEventsBound = true;
}

/**
 * 初始化水波纹背景、交互与页面可见性处理。
 *
 * @returns {void}
 * @note 图片或插件异常时保留静态背景，不阻断页面其他功能。
 */
export function initRipples() {
    const rippleContainer = document.getElementById('ripple-container');
    if (!rippleContainer) {
        console.error('水波纹容器不存在');
        return;
    }

    /** 使用稳定的本地资源地址，让浏览器缓存背景图。 */
    const bgUrl = RIPPLE_CONFIG.backgroundImage;
    rippleContainer.style.backgroundImage = `url('${bgUrl}')`;

    preloadImage(
        bgUrl,
        () => {
            startRipplePlugin(rippleContainer);
            bindInteractionEvents(rippleContainer);
            bindVisibilityEvents(rippleContainer);
            startAutoRipples(rippleContainer);
        },
        () => {
            console.warn('动态背景图片加载失败，已保留页面基础样式。');
        }
    );
}
