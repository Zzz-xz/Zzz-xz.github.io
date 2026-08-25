/**
 * 更新页面上的本地时间。
 *
 * @returns {void}
 * @note 时间节点缺失时安全返回，避免阻断其他初始化流程。
 */
export function updateTime() {
    const timeDisplay = document.getElementById('timeDisplay');
    if (!timeDisplay) return;

    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    timeDisplay.textContent = `${h}:${m}:${s}`;
    timeDisplay.dateTime = now.toISOString();
}
