/** 每分钟的毫秒数。 */
const MINUTE_MS = 60000;

/** 用于越过分钟边界的微小缓冲，避免定时器提前触发。 */
const CLOCK_ALIGNMENT_BUFFER_MS = 40;

/** 当前时钟定时器标识。 */
let clockTimerId = null;

/**
 * 更新页面上的本地时间。
 *
 * @returns {boolean} 成功更新时返回 true，时间节点缺失时返回 false。
 * @note 仅显示小时与分钟，降低页面中的持续视觉干扰。
 */
function updateTime() {
    const timeDisplay = document.getElementById('timeDisplay');
    if (!timeDisplay) return false;

    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    timeDisplay.textContent = `${h}:${m}`;
    timeDisplay.dateTime = now.toISOString();
    return true;
}

/**
 * 将下一次更新时间对齐到真实的分钟边界。
 *
 * @returns {void}
 * @note 标签页被浏览器挂起后，恢复时会根据当前时间重新对齐，不累积漂移。
 */
function scheduleNextMinute() {
    const elapsedInMinute = Date.now() % MINUTE_MS;
    const delay = MINUTE_MS - elapsedInMinute + CLOCK_ALIGNMENT_BUFFER_MS;

    clockTimerId = window.setTimeout(() => {
        clockTimerId = null;
        if (updateTime()) scheduleNextMinute();
    }, delay);
}

/**
 * 启动按分钟更新的本地时钟。
 *
 * @returns {void}
 * @note 重复调用时会先清理旧定时器，保证初始化幂等。
 */
export function startClock() {
    if (clockTimerId !== null) {
        window.clearTimeout(clockTimerId);
        clockTimerId = null;
    }

    if (!updateTime()) return;
    scheduleNextMinute();
}
