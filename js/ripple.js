// 水波纹配置（可根据需求调整）
export const RIPPLE_CONFIG = {
    resolution: 450,        // 分辨率（越低性能越好）
    dropRadius: 10,         // 波纹半径
    perturbance: 0.018,     // 扰动强度
    minRippleInterval: 25,  // 连续波纹间隔（毫秒）
    minRadius: 0.002,       // 最小波纹半径
    maxRadius: 0.035,       // 最大波纹半径
    autoRippleRadius: 8,    // 自动波纹半径
    autoRippleInterval: 4000,// 自动波纹间隔（毫秒）
    autoPerturbance: 0.07,  // 自动波纹扰动强度
    clickIntensity: 1.4,    // 点击波纹强度倍数
    mouseStaticDelay: 700,  // 静止后恢复自动波纹延迟（毫秒）
    backgroundImage: '../assets/images/background.jpg' // 本地背景图路径
};

// 水波纹全局状态
let autoRippleTimer = null;
let isMouseMoving = false;
let mouseStaticTimer = null;
let lastRippleTime = 0;

/**
 * 给图片URL添加时间戳（防缓存）
 */
function getUrlWithTimestamp(url) {
    const timestamp = new Date().getTime();
    return `${url}?t=${timestamp}`;
}

/**
 * 获取鼠标/触摸位置
 */
function getPointerPosition(e, isTouch) {
    if (isTouch && e.touches && e.touches[0]) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

/**
 * 预加载图片
 */
function preloadImage(url, onSuccess, onError) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = onSuccess;
    img.onerror = onError;
}

/**
 * 初始化水波纹插件
 */
export function startRipplePlugin(container) {
    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    // 销毁旧实例
    if ($(container).data('ripples')) {
        try {
            $(container).ripples('destroy');
        } catch (e) {
            console.error('销毁旧波纹实例失败:', e);
        }
    }

    // 初始化插件
    try {
        $(container).ripples({
            resolution: RIPPLE_CONFIG.resolution,
            dropRadius: RIPPLE_CONFIG.dropRadius,
            perturbance: RIPPLE_CONFIG.perturbance,
            interactive: true,
            crossOrigin: 'anonymous'
        });
    } catch (e) {
        console.error('水波纹初始化失败:', e);
        alert('水波纹特效加载失败，请刷新页面重试');
    }
}

/**
 * 绑定交互事件（鼠标/触摸）
 */
function bindInteractionEvents(container) {
    // 鼠标移动（连续波纹）
    container.addEventListener('mousemove', (e) => {
        handleContinuousRipple(e, container, false);
    });

    // 鼠标点击（强波纹）
    container.addEventListener('click', (e) => {
        if (!e.target.closest('.social-link')) { // 排除按钮区域
            handleSingleRipple(e, container, false);
        }
    });

    // 触屏滑动（连续波纹）
    container.addEventListener('touchmove', (e) => {
        e.preventDefault();
        handleContinuousRipple(e, container, true);
    }, { passive: false });

    // 触屏触摸（强波纹）
    container.addEventListener('touchstart', (e) => {
        if (!e.target.closest('.social-link')) {
            handleSingleRipple(e, container, true);
        }
    }, { passive: true });
}

/**
 * 处理连续波纹（鼠标/触摸移动时）
 */
function handleContinuousRipple(e, container, isTouch) {
    isMouseMoving = true;
    clearTimeout(mouseStaticTimer);

    // 暂停自动波纹
    if (autoRippleTimer) {
        clearInterval(autoRippleTimer);
        autoRippleTimer = null;
    }

    // 控制波纹频率
    const now = Date.now();
    if (now - lastRippleTime < RIPPLE_CONFIG.minRippleInterval) return;

    const { x, y } = getPointerPosition(e, isTouch);
    const radius = RIPPLE_CONFIG.minRadius + Math.random() * (RIPPLE_CONFIG.maxRadius - RIPPLE_CONFIG.minRadius);
    $(container).ripples('drop', x, y, radius, RIPPLE_CONFIG.perturbance * 0.75);

    lastRippleTime = now;

    // 静止后恢复自动波纹
    mouseStaticTimer = setTimeout(() => {
        isMouseMoving = false;
        startAutoRipples(container);
    }, RIPPLE_CONFIG.mouseStaticDelay);
}

/**
 * 处理单次波纹（点击/触摸时）
 */
function handleSingleRipple(e, container, isTouch) {
    const { x, y } = getPointerPosition(e, isTouch);
    const radius = RIPPLE_CONFIG.dropRadius * RIPPLE_CONFIG.clickIntensity;
    const perturbance = RIPPLE_CONFIG.perturbance * RIPPLE_CONFIG.clickIntensity;
    $(container).ripples('drop', x, y, radius, perturbance);
}

/**
 * 启动自动波纹（无交互时）
 */
export function startAutoRipples(container) {
    if (isMouseMoving || autoRippleTimer) return;

    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    autoRippleTimer = setInterval(() => {
        if (isMouseMoving) {
            clearInterval(autoRippleTimer);
            autoRippleTimer = null;
            return;
        }

        const randomX = Math.random() * containerRect.width;
        const randomY = Math.random() * containerRect.height;
        const randomRadius = RIPPLE_CONFIG.autoRippleRadius + (Math.random() - 0.5) * 2;

        $(container).ripples('drop', randomX, randomY, randomRadius, RIPPLE_CONFIG.autoPerturbance);
    }, RIPPLE_CONFIG.autoRippleInterval);
}

/**
 * 初始化水波纹主函数
 */
export function initRipples() {
    const rippleContainer = document.getElementById('ripple-container');
    if (!rippleContainer) {
        console.error('水波纹容器不存在');
        return;
    }

    // 设置背景图（防缓存）
    const bgUrl = getUrlWithTimestamp(RIPPLE_CONFIG.backgroundImage);
    rippleContainer.style.backgroundImage = `url('${bgUrl}')`;

    // 预加载背景图
    preloadImage(bgUrl, () => {
        startRipplePlugin(rippleContainer);
        bindInteractionEvents(rippleContainer);
        startAutoRipples(rippleContainer);
        initPageElements(); // 图片加载完成后显示页面元素
    });
}

/**
 * 初始化页面元素动画
 */
function initPageElements() {
    const heroContainer = document.querySelector('.hero-container');
    const footer = document.querySelector('.footer');

    setTimeout(() => {
        heroContainer.style.animationDelay = '0.2s';
        heroContainer.style.opacity = 1;
    }, 100);

    setTimeout(() => {
        footer.style.animationDelay = '0.4s';
        footer.style.opacity = 1;
    }, 300);
}