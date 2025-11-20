// 导入其他模块
import { updateTime } from './time.js';
import { initRipples, startRipplePlugin } from './ripple.js';

/**
 * 主初始化函数
 */
function init() {
    // 检查依赖是否加载
    if (typeof jQuery === 'undefined') {
        console.error('jQuery 未加载');
        alert('水波纹特效依赖 jQuery，请刷新页面重试');
        return;
    }
    if (typeof jQuery.fn.ripples === 'undefined') {
        console.error('jquery.ripples 插件未加载');
        alert('水波纹特效依赖 ripples 插件，请刷新页面重试');
        return;
    }

    // 初始化水波纹
    initRipples();

    // 初始化时间显示（每秒更新）
    updateTime();
    setInterval(updateTime, 1000);

    // 窗口大小变化时重新初始化波纹
    window.addEventListener('resize', () => {
        const rippleContainer = document.getElementById('ripple-container');
        if (rippleContainer && $(rippleContainer).data('ripples')) {
            startRipplePlugin(rippleContainer);
        }
    });

    // 阻止社交链接点击冒泡到波纹容器
    document.querySelectorAll('.social-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
}

// 页面加载完成后初始化
window.addEventListener('load', init);