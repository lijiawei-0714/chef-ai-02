// ===== 全局状态 =====
let currentCategory = '全部';
let currentIngredientFilter = 'all';
let searchKeyword = '';

// ===== 分类配置 =====
const categories = ['全部', '凉菜', '热菜', '荤菜', '汤羹', '主食', '小吃', '甜品', '酱料', '饮品'];
const categoryEmojis = { '全部': '🍽️', '凉菜': '🥗', '热菜': '🔥', '荤菜': '🥩', '汤羹': '🍲', '主食': '🍚', '小吃': '🥟', '甜品': '🍰', '酱料': '🫙', '饮品': '🥤' };

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    renderCategoryTabs();
    renderIngredients();
    renderRecipes();
    initNavScroll();
});

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

// ===== 渲染分类标签 =====
function renderCategoryTabs() {
    const container = document.getElementById('categoryTabs');
    container.innerHTML = categories.map(cat =>
        `<button class="cat-tab ${cat === currentCategory ? 'active' : ''}" onclick="selectCategory('${cat}')">${categoryEmojis[cat] || ''} ${cat}</button>`
    ).join('');
}

// ===== 选择分类 =====
function selectCategory(cat) {
    currentCategory = cat;
    renderCategoryTabs();
    renderRecipes();
}

// ===== 渲染食材卡片 =====
function renderIngredients(filter) {
    const container = document.getElementById('ingredientGrid');
    let data = ingredients;
    if (filter && filter !== 'all') {
        data = ingredients.filter(ing => ing.tag === filter);
    }
    container.innerHTML = data.map((ing, idx) =>
        `<div class="ingredient-card" onclick="showIngredient(${ingredients.indexOf(ing)})">
            <span class="tag">${ing.tag}</span>
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

// ===== 渲染食谱卡片 =====
function renderRecipes() {
    const container = document.getElementById('recipeGrid');
    const countEl = document.getElementById('recipeCount');
    let data = recipes;

    // 分类筛选
    if (currentCategory !== '全部') {
        data = data.filter(r => r.c === currentCategory);
    }

    // 搜索筛选
    if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        data = data.filter(r =>
            r.n.toLowerCase().includes(kw) ||
            r.i.toLowerCase().includes(kw) ||
            r.c.toLowerCase().includes(kw)
        );
    }

    countEl.textContent = `共 ${data.length} 道食谱`;

    if (data.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);grid-column:1/-1;"><p style="font-size:1.2rem;">😅 没有找到匹配的食谱</p><p>试试其他关键词吧</p></div>';
        return;
    }

    container.innerHTML = data.map((r, idx) =>
        `<div class="recipe-card" onclick="showRecipe(${recipes.indexOf(r)})">
            <div class="recipe-card-header">
                <h3>${r.n}</h3>
                <span class="cat-label">${categoryEmojis[r.c] || ''} ${r.c}</span>
            </div>
            <div class="recipe-card-body">
                <div class="ingredients-preview">🧂 ${r.i}</div>
                <div class="steps-count">📝 ${r.s.length} 个步骤 · 点击查看详情</div>
            </div>
        </div>`
    ).join('');
}

// ===== 搜索食谱 =====
function filterRecipes() {
    searchKeyword = document.getElementById('recipeSearch').value.trim();
    renderRecipes();
}


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
        <span class="modal-cat" style="background:var(--green-light);color:var(--green);">${ing.tag}</span>
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
