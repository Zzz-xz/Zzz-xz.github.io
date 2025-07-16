// ================= 粒子系统核心 =================
class Particle {
    constructor(x, y, id) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.size = Math.random() * 2 + 0.8;
        this.speedX = Math.random() * 2 - 1;
        this.speedY = Math.random() * 2 - 1;
        this.color = `hsla(${Math.random() * 360}, 80%, 65%, 0.7)`;
        this.life = Math.random() * 300 + 200;
        this.maxLife = this.life;
        this.linkedParticles = new Set();
        this.clusterId = null;
        this.alpha = 0.7;
        this.inertia = 0; // 新增惯性系数
    }

    update(mouse) {
        // 随机运动（降低幅度至0.12减少抖动）
        this.speedX += (Math.random() - 0.5) * 0.12;
        this.speedY += (Math.random() - 0.5) * 0.12;
        
        // 速度限制
        const speedLimit = 2;
        this.speedX = Math.max(-speedLimit, Math.min(this.speedX, speedLimit));
        this.speedY = Math.max(-speedLimit, Math.min(this.speedY, speedLimit));
        
        // 位置更新
        this.x += this.speedX;
        this.y += this.speedY;
        
        // 边界反弹
        if (this.x < 0 || this.x > canvas.width) {
            this.speedX *= -0.8;
            this.x = this.x < 0 ? 0 : canvas.width;
        }
        if (this.y < 0 || this.y > canvas.height) {
            this.speedY *= -0.8;
            this.y = this.y < 0 ? 0 : canvas.height;
        }
        
        // 生命周期管理
        this.life--;
        this.alpha = (this.life / this.maxLife) * 0.7;
        
        // 鼠标交互
        if (mouse.active) {
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 150) { // 引力场范围
                const force = (150 - distance) * 0.02;
                this.speedX -= (dx / distance) * force;
                this.speedY -= (dy / distance) * force;
                
                // 加入集群
                if (!this.clusterId && distance < 100) {
                    this.clusterId = mouse.clusterId;
                }
                
                // 重置生命周期
                this.life = this.maxLife;
                this.inertia = 1.0; // 激活惯性
            }
        } else if (this.inertia > 0) {
            // 鼠标离开后惯性衰减
            this.inertia *= 0.92;
            if (this.inertia < 0.05) {
                this.clusterId = null; // 完全解除集群
            }
        }
        
        // 集群行为（优化抖动问题）
        if (this.clusterId) {
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 降低牵引力强度至0.015并增加速度衰减
            if (distance > 30) {
                const force = 0.015 * this.inertia;
                this.speedX -= (dx / distance) * force;
                this.speedY -= (dy / distance) * force;
            }
            // 新增速度衰减系数0.92防止抖动
            this.speedX *= 0.92;
            this.speedY *= 0.92;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color.replace('0.7', this.alpha);
        ctx.fill();
    }
}

// ================= 粒子系统管理器 =================
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.particleCount = 60;
        this.particlePool = [];
        this.mouse = { x: 0, y: 0, active: false, clusterId: null };
        this.lastClusterId = 0;
        
        // 初始化粒子池
        for (let i = 0; i < this.particleCount * 2; i++) {
            this.particlePool.push(
                new Particle(
                    Math.random() * canvas.width,
                    Math.random() * canvas.height,
                    i
                )
            );
        }
        
        // 激活初始粒子
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push(this.createParticle());
        }
    }
    
    createParticle() {
        if (this.particlePool.length > 0) {
            const particle = this.particlePool.pop();
            particle.life = Math.random() * 300 + 200;
            particle.maxLife = particle.life;
            particle.alpha = 0.7;
            particle.clusterId = null;
            particle.linkedParticles.clear();
            particle.inertia = 0;
            return particle;
        }
        return new Particle(
            Math.random() * canvas.width,
            Math.random() * canvas.height,
            this.particles.length
        );
    }
    
    recycleParticle(particle) {
        particle.life = 0;
        particle.alpha = 0;
        this.particlePool.push(particle);
    }
    
    update() {
        // 更新现有粒子
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(this.mouse);
            
            // 生命周期结束的粒子回收
            if (this.particles[i].life <= 0) {
                this.recycleParticle(this.particles[i]);
                this.particles.splice(i, 1);
            }
        }
        
        // 维持粒子数量
        while (this.particles.length < this.particleCount) {
            this.particles.push(this.createParticle());
        }
        
        // 更新集群ID（防止鼠标快速移动产生多个集群）
        if (!this.mouse.active) {
            this.mouse.clusterId = null;
        } else if (!this.mouse.clusterId) {
            this.mouse.clusterId = ++this.lastClusterId;
        }
        
        // 粒子链接检测（放宽距离阈值至45px减少抖动）
        this.checkParticleLinks();
    }
    
    checkParticleLinks() {
        // 清空现有链接
        for (const particle of this.particles) {
            particle.linkedParticles.clear();
        }
        
        // 建立新链接
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const p1 = this.particles[i];
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 同集群粒子自动链接（距离放宽至85px）
                if (p1.clusterId && p2.clusterId && p1.clusterId === p2.clusterId && distance < 85) {
                    p1.linkedParticles.add(p2.id);
                    p2.linkedParticles.add(p1.id);
                }
                // 非集群粒子在近距离时链接（距离放宽至45px）
                else if (!p1.clusterId && !p2.clusterId && distance < 45) {
                    p1.linkedParticles.add(p2.id);
                    p2.linkedParticles.add(p1.id);
                }
            }
        }
    }
    
    draw(ctx) {
        // 绘制粒子间连线
        ctx.lineWidth = 0.8;
        
        for (const particle of this.particles) {
            for (const linkedId of particle.linkedParticles) {
                const target = this.particles.find(p => p.id === linkedId);
                if (target) {
                    const alpha = Math.min(particle.alpha, target.alpha);
                    ctx.beginPath();
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(target.x, target.y);
                    ctx.strokeStyle = `hsla(210, 80%, 70%, ${alpha * 0.5})`;
                    ctx.stroke();
                }
            }
        }
        
        // 绘制粒子
        for (const particle of this.particles) {
            particle.draw(ctx);
        }
    }
    
    handleMouseMove(x, y) {
        this.mouse.x = x;
        this.mouse.y = y;
        this.mouse.active = true;
    }
    
    handleMouseLeave() {
        this.mouse.active = false;
    }
}

// ================= 主程序 =================
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particleSystem;

function init() {
    // 设置Canvas尺寸
    resizeCanvas();
    
    // 初始化粒子系统
    particleSystem = new ParticleSystem();
    
    // 启动动画循环
    animate();
    
    // 初始化时间显示
    updateTime();
    setInterval(updateTime, 1000);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制半透明背景层（实现运动模糊效果）
    ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 更新并绘制粒子系统
    particleSystem.update();
    particleSystem.draw(ctx);
    
    requestAnimationFrame(animate);
}

// 精准时间显示
function updateTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('timeDisplay').textContent = `${h}:${m}:${s}`;
}

// ================= 事件监听 =================
window.addEventListener('load', init);
window.addEventListener('resize', resizeCanvas);

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    particleSystem.handleMouseMove(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener('mouseleave', () => {
    particleSystem.handleMouseLeave();
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    particleSystem.handleMouseMove(touch.clientX - rect.left, touch.clientY - rect.top);
}, { passive: false });

canvas.addEventListener('touchend', () => {
    particleSystem.handleMouseLeave();
});