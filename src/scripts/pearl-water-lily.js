/**
 * @file pearl-water-lily.js
 * @brief 驱动珍珠折光水莲的协调微倾、局部折光与轻触回稳反馈。
 */

const LILY_SELECTOR = '[data-pearl-water-lily]';
const LAYER_SELECTOR = '[data-lily-layer]';
const MOTION_SELECTOR = '[data-lily-motion]';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
const LILY_FOCUS_X_RATIO = 0.561;
const LILY_FOCUS_Y_RATIO = 0.449;
const POINTER_TRAVEL_PX = 12;
const POINTER_ROTATION_DEG = 0.9;
const BLOOM_DURATION_MS = 640;
const TAP_MOVE_TOLERANCE_PX = 8;
const RESTING_GLINT_OPACITY = 0.28;
const ACTIVE_GLINT_OPACITY = 0.62;
const RESTING_RIM_OPACITY = 0.15;
const ACTIVE_RIM_OPACITY = 0.34;

/**
 * 将数值限制在指定范围内。
 *
 * @param {number} value 待限制的数值。
 * @param {number} minimum 最小值。
 * @param {number} maximum 最大值。
 * @returns {number} 限制后的数值。
 */
function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}

/**
 * 判断指针是否落在水莲的椭圆形有效区域内。
 *
 * @param {DOMRect} rect 水莲的视口边界。
 * @param {number} clientX 指针的视口横坐标。
 * @param {number} clientY 指针的视口纵坐标。
 * @returns {boolean} 位于有效区域时返回 true。
 */
function isInsideLily(rect, clientX, clientY) {
    if (rect.width <= 0 || rect.height <= 0) return false;

    const centerX = rect.left + rect.width * LILY_FOCUS_X_RATIO;
    const centerY = rect.top + rect.height * LILY_FOCUS_Y_RATIO;
    const horizontal = (clientX - centerX) / (rect.width * 0.3);
    const vertical = (clientY - centerY) / (rect.height * 0.25);

    return horizontal * horizontal + vertical * vertical <= 1;
}

/**
 * 将所有折光层平稳恢复到静止位置。
 *
 * @param {HTMLElement} root 水莲根元素。
 * @param {Array<HTMLElement | SVGElement>} layers 可移动的水莲图层。
 * @returns {void}
 */
function resetPose(root, layers) {
    root.classList.remove('is-near');
    root.style.setProperty('--lily-glint-opacity', String(RESTING_GLINT_OPACITY));
    root.style.setProperty('--lily-rim-opacity', String(RESTING_RIM_OPACITY));

    layers.forEach((layer) => {
        layer.style.setProperty('--layer-x', '0px');
        layer.style.setProperty('--layer-y', '0px');
        layer.style.setProperty('--layer-rotate', '0deg');
    });
}

/**
 * 根据指针距离协调叶面、整花与局部高光的位置。
 *
 * @param {HTMLElement} root 水莲根元素。
 * @param {Array<HTMLElement | SVGElement>} layers 可移动的水莲图层。
 * @param {number} clientX 指针的视口横坐标。
 * @param {number} clientY 指针的视口纵坐标。
 * @returns {void}
 * @note 仅写入 transform 与 opacity 相关变量，不触发布局计算。
 */
function updatePose(root, layers, clientX, clientY) {
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const deltaX = clientX - (rect.left + rect.width * LILY_FOCUS_X_RATIO);
    const deltaY = clientY - (rect.top + rect.height * LILY_FOCUS_Y_RATIO);
    const radiusX = rect.width * 0.78;
    const radiusY = rect.height * 0.94;
    const normalizedDistance = Math.hypot(deltaX / radiusX, deltaY / radiusY);
    const influence = clamp(1 - normalizedDistance, 0, 1);

    if (influence <= 0) {
        resetPose(root, layers);
        return;
    }

    const normalizedX = clamp(deltaX / radiusX, -1, 1) * influence;
    const normalizedY = clamp(deltaY / radiusY, -1, 1) * influence;
    root.classList.toggle('is-near', influence > 0.04);
    root.style.setProperty(
        '--lily-glint-opacity',
        String(RESTING_GLINT_OPACITY + (ACTIVE_GLINT_OPACITY - RESTING_GLINT_OPACITY) * influence)
    );
    root.style.setProperty(
        '--lily-rim-opacity',
        String(RESTING_RIM_OPACITY + (ACTIVE_RIM_OPACITY - RESTING_RIM_OPACITY) * influence)
    );

    layers.forEach((layer) => {
        const depth = Number.parseFloat(layer.dataset.lilyDepth ?? '0');
        const offsetX = normalizedX * depth * POINTER_TRAVEL_PX;
        const offsetY = normalizedY * depth * POINTER_TRAVEL_PX;
        const rotation = normalizedX * depth * POINTER_ROTATION_DEG;

        layer.style.setProperty('--layer-x', `${offsetX.toFixed(2)}px`);
        layer.style.setProperty('--layer-y', `${offsetY.toFixed(2)}px`);
        layer.style.setProperty('--layer-rotate', `${rotation.toFixed(3)}deg`);
    });
}

/**
 * 触发一次整花轻压并自然回稳的反馈。
 *
 * @param {HTMLElement} motion 水莲动画容器。
 * @param {() => void} onComplete 动画完成后的状态清理回调。
 * @returns {number | null} 清理动画类名的定时器标识；动画进行中返回 null。
 */
function triggerBloom(motion, onComplete) {
    if (motion.classList.contains('is-blooming')) return null;

    motion.classList.add('is-blooming');
    return window.setTimeout(() => {
        motion.classList.remove('is-blooming');
        onComplete();
    }, BLOOM_DURATION_MS);
}

/**
 * 初始化首页珍珠折光水莲。
 *
 * @returns {void}
 * @note 重复调用会被元素状态阻止；减少动态偏好下保持完全静态。
 */
export function initPearlWaterLily() {
    const root = document.querySelector(LILY_SELECTOR);
    if (!(root instanceof HTMLElement) || root.dataset.pearlLilyInitialized === 'true') return;

    const motion = root.querySelector(MOTION_SELECTOR);
    const layers = Array.from(root.querySelectorAll(LAYER_SELECTOR))
        .filter((layer) => layer instanceof HTMLElement || layer instanceof SVGElement);

    if (!(motion instanceof HTMLElement) || layers.length === 0) return;

    root.dataset.pearlLilyInitialized = 'true';

    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    let animationFrameId = 0;
    let bloomTimerId = 0;
    let pendingPointer = null;
    let pressOrigin = null;

    /**
     * 在下一绘制帧应用最后一次指针位置，合并高频移动事件。
     *
     * @returns {void}
     */
    function renderPointerPose() {
        animationFrameId = 0;
        if (!pendingPointer || document.hidden) return;

        updatePose(root, layers, pendingPointer.clientX, pendingPointer.clientY);
        pendingPointer = null;
    }

    /**
     * 收集指针位置并按帧调度视觉更新。
     *
     * @param {PointerEvent} event 指针移动事件。
     * @returns {void}
     */
    function handlePointerMove(event) {
        if (reducedMotion.matches || !event.isPrimary || event.pointerType === 'touch') return;

        pendingPointer = { clientX: event.clientX, clientY: event.clientY };
        if (animationFrameId === 0) {
            animationFrameId = window.requestAnimationFrame(renderPointerPose);
        }
    }

    /**
     * 记录水莲有效区域内的按压起点。
     *
     * @param {PointerEvent} event 指针按下事件。
     * @returns {void}
     */
    function handlePointerDown(event) {
        if (
            reducedMotion.matches
            || !event.isPrimary
            || !isInsideLily(root.getBoundingClientRect(), event.clientX, event.clientY)
        ) return;

        pressOrigin = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY
        };
    }

    /**
     * 在轻触未发生明显移动时触发水莲回稳反馈。
     *
     * @param {PointerEvent} event 指针抬起事件。
     * @returns {void}
     * @note 通过移动阈值避免把触屏滚动误判为轻触。
     */
    function handlePointerUp(event) {
        if (!pressOrigin || event.pointerId !== pressOrigin.pointerId) return;

        const travel = Math.hypot(
            event.clientX - pressOrigin.clientX,
            event.clientY - pressOrigin.clientY
        );
        const isTap = travel <= TAP_MOVE_TOLERANCE_PX
            && isInsideLily(root.getBoundingClientRect(), event.clientX, event.clientY);
        pressOrigin = null;

        if (!isTap) return;

        const timerId = triggerBloom(motion, () => {
            bloomTimerId = 0;
        });
        if (timerId !== null) bloomTimerId = timerId;
    }

    /**
     * 取消未完成的按压记录。
     *
     * @param {PointerEvent} event 指针取消事件。
     * @returns {void}
     */
    function handlePointerCancel(event) {
        if (pressOrigin?.pointerId === event.pointerId) pressOrigin = null;
    }

    /**
     * 页面失焦或进入后台时立即停止待处理任务并恢复静态。
     *
     * @returns {void}
     */
    function suspendMotion() {
        pendingPointer = null;
        pressOrigin = null;

        if (animationFrameId !== 0) {
            window.cancelAnimationFrame(animationFrameId);
            animationFrameId = 0;
        }

        if (bloomTimerId !== 0) {
            window.clearTimeout(bloomTimerId);
            bloomTimerId = 0;
        }

        motion.classList.remove('is-blooming');
        resetPose(root, layers);
    }

    /**
     * 在用户启用减少动态偏好时立即停止并复位效果。
     *
     * @param {MediaQueryListEvent} event 动态偏好变化事件。
     * @returns {void}
     */
    function handleMotionPreferenceChange(event) {
        if (event.matches) suspendMotion();
    }

    if (reducedMotion.matches) resetPose(root, layers);

    if (window.matchMedia(FINE_POINTER_QUERY).matches) {
        window.addEventListener('pointermove', handlePointerMove, { passive: true });
    }

    window.addEventListener('blur', suspendMotion);
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerCancel, { passive: true });
    if (typeof reducedMotion.addEventListener === 'function') {
        reducedMotion.addEventListener('change', handleMotionPreferenceChange);
    }
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) suspendMotion();
    });
}
