function updateTime() {
    const now = new Date();
    const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    
    // 日期格式化（补零处理）
    const dateStr = `${now.getFullYear()}年${(now.getMonth()+1).toString().padStart(2,'0')}月${now.getDate().toString().padStart(2,'0')}日`;
    
    // 时间格式化
    const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    
    // 更新DOM
    document.getElementById('date').textContent = dateStr;
    document.getElementById('time').textContent = timeStr; 
    document.getElementById('weekday').textContent = days[now.getDay()];
}

// 初始加载+每秒更新
window.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 1000);
});
