export function updateTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0'); // 补零为2位
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('timeDisplay').textContent = `${h}:${m}:${s}`;
}