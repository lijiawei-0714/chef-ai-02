// ===== 全局状态 =====
let currentCategory = '全部';
let currentIngredientFilter = 'all';
let searchKeyword = '';
let displayCount = 12;           // 当前显示的食谱数量
const LOAD_MORE_STEP = 12;       // 每次加载更多的数量

// ===== Toast 通知组件 =====
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const icon = icons[type] || icons.info;

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-text">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    // 自动消失
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ===== 分类配置 =====
const categories = ['全部', '凉菜', '热菜', '荤菜', '汤羹', '主食', '小吃', '甜品', '酱料', '饮品'];
const categoryEmojis = { '全部': '🍽️', '凉菜': '🥗', '热菜': '🔥', '荤菜': '🥩', '汤羹': '🍲', '主食': '🍚', '小吃': '🥟', '甜品': '🍰', '酱料': '🫙', '饮品': '🥤' };

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    renderCategoryTabs();
    // 先显示骨架屏
    showSkeletons();
    // 模拟数据加载延迟后渲染实际内容
    setTimeout(() => {
        renderIngredients();
        renderRecipes();
    }, 400);
    initNavScroll();
    initBackToTop();
});

// ===== 骨架屏 Loading =====
function showSkeletons() {
    // 食材骨架屏
    const ingredientGrid = document.getElementById('ingredientGrid');
    ingredientGrid.innerHTML = Array(6).fill(`
        <div class="skeleton-ingredient">
            <div class="skeleton-ingredient-inner">
                <div class="skeleton skeleton-tag"></div>
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text"></div>
            </div>
        </div>
    `).join('');

    // 食谱骨架屏
    const recipeGrid = document.getElementById('recipeGrid');
    recipeGrid.innerHTML = Array(8).fill(`
        <div class="skeleton-card">
            <div class="skeleton-card-header">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-tag"></div>
            </div>
            <div class="skeleton-card-body">
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text"></div>
            </div>
        </div>
    `).join('');
}

// ===== 防抖函数 =====
function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ===== 导航栏滚动高亮 =====
function initNavScroll() {
    const sections = document.querySelectorAll('.hero, .section');
    const navLinks = document.querySelectorAll('.nav-link');
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(sec => {
            if (window.scrollY >= sec.offsetTop - 100) current = sec.id;
        });
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) link.classList.add('active');
        });
    });
}

// ===== 移动端汉堡菜单 =====
function toggleNavMenu() {
    document.getElementById('navLinks').classList.toggle('show');
}

// 点击导航链接后关闭菜单
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('nav-link')) {
        document.getElementById('navLinks').classList.remove('show');
    }
});

// ===== 回到顶部按钮 =====
function initBackToTop() {
    const btn = document.getElementById('backToTop');
    window.addEventListener('scroll', () => {
        btn.classList.toggle('show', window.scrollY > 400);
    });
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== 渲染分类标签 =====
function renderCategoryTabs() {
    const container = document.getElementById('categoryTabs');
    container.innerHTML = categories.map(cat =>
        `<button class="cat-tab ${cat === currentCategory ? 'active' : ''}" onclick="selectCategory('${cat}')">${categoryEmojis[cat] || ''} ${cat}</button>`
    ).join('');
}

// ===== 选择分类 =====
function selectCategory(cat, scrollToRecipes = false) {
    currentCategory = cat;
    displayCount = 12;
    renderCategoryTabs();
    renderRecipes();
    if (scrollToRecipes) {
        document.getElementById('recipes').scrollIntoView({ behavior: 'smooth' });
    }
}

// ===== 渲染食材卡片 =====
function renderIngredients(filter) {
    const container = document.getElementById('ingredientGrid');
    let data = ingredients;
    let indices = ingredients.map((_, i) => i);
    if (filter && filter !== 'all') {
        indices = [];
        data = ingredients.filter((ing, i) => {
            if (ing.c === filter) { indices.push(i); return true; }
            return false;
        });
    }
    container.innerHTML = data.map((ing, idx) =>
        `<div class="ingredient-card" onclick="showIngredient(${indices[idx]})">
            <span class="tag">${ing.c}</span>
            <h3>${ing.n}</h3>
            <p>${ing.desc}</p>
        </div>`
    ).join('');
}

// ===== 筛选食材 =====
function filterIngredients(cat) {
    currentIngredientFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === (cat === 'all' ? '全部' : cat));
    });
    renderIngredients(cat);
}

// ===== 从页脚跳转到指定分类 =====
function goToCategory(cat) {
    selectCategory(cat, true);
}

// ===== 渲染食谱卡片 =====
function renderRecipes() {
    const container = document.getElementById('recipeGrid');
    const countEl = document.getElementById('recipeCount');
    let data = recipes;
    let indices = recipes.map((_, i) => i);

    if (currentCategory !== '全部') {
        indices = [];
        data = recipes.filter((r, i) => {
            if (r.c === currentCategory) { indices.push(i); return true; }
            return false;
        });
    }

    if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        const filteredIndices = [];
        data = data.filter((r, idx) => {
            if (r.n.toLowerCase().includes(kw) || r.i.toLowerCase().includes(kw) || r.c.toLowerCase().includes(kw)) {
                filteredIndices.push(indices[idx]);
                return true;
            }
            return false;
        });
        indices = filteredIndices;
    }

    countEl.textContent = `共 ${data.length} 道食谱`;

    if (data.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);grid-column:1/-1;"><p style="font-size:1.2rem;">😅 没有找到匹配的食谱</p><p>试试其他关键词吧</p></div>';
        return;
    }

    const displayData = data.slice(0, displayCount);
    const hasMore = displayCount < data.length;

    container.innerHTML = displayData.map((r, idx) => {
        const emoji = categoryEmojis[r.c] || '🍽️';
        return `<div class="recipe-card" onclick="showRecipe(${indices[idx]})">
            <div class="recipe-card-header">
                <h3>${emoji} ${r.n}</h3>
                <span class="cat-label">${categoryEmojis[r.c] || ''} ${r.c}</span>
            </div>
            <div class="recipe-card-body">
                <div class="ingredients-preview">🧂 ${r.i}</div>
                <div class="steps-count">📝 ${r.s.length} 个步骤 · 点击查看详情</div>
            </div>
        </div>`;
    }).join('') + (hasMore ? `<div class="load-more-wrap"><button class="load-more-btn" onclick="loadMoreRecipes()">加载更多（还有 ${data.length - displayCount} 道）</button></div>` : '');
}

function loadMoreRecipes() {
    displayCount += LOAD_MORE_STEP;
    renderRecipes();
}

// ===== 搜索食谱（防抖） =====
const filterRecipes = debounce(function() {
    searchKeyword = document.getElementById('recipeSearch').value.trim();
    displayCount = 12;
    renderRecipes();
}, 250);


// ===== 显示食谱详情 =====
function showRecipe(idx) {
    const r = recipes[idx];
    const content = document.getElementById('modalContent');
    content.innerHTML = `
        <h2>${r.n}</h2>
        <span class="modal-cat">${categoryEmojis[r.c] || ''} ${r.c}</span>
        <h3>🧂 所需食材</h3>
        <div class="ingredients-list">
            ${r.i.split(',').map(item => `<span>${item.trim()}</span>`).join('')}
        </div>
        <h3>📝 烹饪步骤</h3>
        <ol class="steps-list">
            ${r.s.map((step, i) => `<li data-step="${i + 1}">${step}</li>`).join('')}
        </ol>
    `;
    document.getElementById('modalOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
}

// ===== 显示食材详情 =====
function showIngredient(idx) {
    const ing = ingredients[idx];
    const content = document.getElementById('modalContent');
    content.innerHTML = `
        <h2>${ing.n}</h2>
        <span class="modal-cat" style="background:var(--green-light);color:var(--green);">${ing.c}</span>
        <p style="margin:12px 0;color:var(--text-light);font-size:1rem;">${ing.desc}</p>
        <div class="info-block">
            <h4>📊 营养价值</h4>
            <p>${ing.nutrition}</p>
        </div>
        <div class="info-block">
            <h4>🧊 保存方法</h4>
            <p>${ing.storage}</p>
        </div>
        <div class="info-block">
            <h4>💡 选购技巧</h4>
            <p>${ing.tip}</p>
        </div>
        <h3>🍳 相关食谱</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
            ${getRelatedRecipes(ing.n).map(name =>
                `<span style="padding:6px 14px;background:var(--primary-light);color:var(--primary);border-radius:50px;font-size:0.85rem;cursor:pointer;" onclick="searchAndShowRecipe('${name}')">${name}</span>`
            ).join('')}
        </div>
    `;
    document.getElementById('modalOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
}

// ===== 获取相关食谱 =====
function getRelatedRecipes(ingredientName) {
    return recipes
        .filter(r => r.i.includes(ingredientName))
        .slice(0, 6)
        .map(r => r.n);
}

// ===== 搜索并显示食谱 =====
function searchAndShowRecipe(name) {
    const idx = recipes.findIndex(r => r.n === name);
    if (idx !== -1) showRecipe(idx);
}

// ===== 关闭弹窗 =====
function closeModal(event) {
    if (event.target === document.getElementById('modalOverlay')) {
        hideModal();
    }
}

function hideModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    document.body.style.overflow = '';
}

// ESC 关闭弹窗
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideModal();
});
