/**
 * @file collection.js
 * @brief 为构建期生成的资源目录提供本地筛选与分类导航交互。
 */

import { createResultMessage, matchesSearch, normalizeSearchText } from '../lib/search.js';
import { replaceCategoryHistory } from '../lib/category-navigation.js';

const STATUS_ANNOUNCE_DELAY_MS = 250;

const state = {
    statusTimerId: null
};

const elements = {
    directory: document.querySelector('[data-resource-directory]'),
    categoryNav: document.getElementById('categoryNav'),
    form: document.getElementById('resourceSearchForm'),
    searchInput: document.getElementById('resourceSearch'),
    clearButton: document.getElementById('clearSearch'),
    clearEmptyButton: document.getElementById('clearEmptySearch'),
    status: document.getElementById('resultStatus'),
    noResults: document.getElementById('noSearchResults')
};

/**
 * 判断资源筛选所需的页面节点是否完整。
 *
 * @returns {boolean} 所有必需节点都存在时返回 true。
 */
function hasRequiredElements() {
    return Object.values(elements).every(Boolean);
}

/**
 * 在纯文本节点中标记当前检索词，同时避免插入不可信 HTML。
 *
 * @param {HTMLElement} target 待更新的文本节点。
 * @param {string} query 当前检索词。
 * @returns {void}
 */
function highlightText(target, query) {
    if (!target.dataset.originalText) {
        target.dataset.originalText = target.textContent ?? '';
    }

    const originalText = target.dataset.originalText;
    const needle = normalizeSearchText(query);
    target.replaceChildren();

    if (!needle) {
        target.textContent = originalText;
        return;
    }

    const searchableText = originalText.toLocaleLowerCase('zh-CN');
    let cursor = 0;
    let matchIndex = searchableText.indexOf(needle, cursor);

    while (matchIndex !== -1) {
        target.append(document.createTextNode(originalText.slice(cursor, matchIndex)));
        const mark = document.createElement('mark');
        mark.textContent = originalText.slice(matchIndex, matchIndex + needle.length);
        target.append(mark);
        cursor = matchIndex + needle.length;
        matchIndex = searchableText.indexOf(needle, cursor);
    }

    target.append(document.createTextNode(originalText.slice(cursor)));
}

/**
 * 延迟更新读屏状态，避免输入过程中产生密集播报。
 *
 * @param {string} message 待播报的信息。
 * @param {boolean} immediate 是否立即更新。
 * @returns {void}
 */
function announceStatus(message, immediate = false) {
    if (state.statusTimerId !== null) {
        window.clearTimeout(state.statusTimerId);
        state.statusTimerId = null;
    }

    if (immediate) {
        elements.status.textContent = message;
        return;
    }

    state.statusTimerId = window.setTimeout(() => {
        state.statusTimerId = null;
        elements.status.textContent = message;
    }, STATUS_ANNOUNCE_DELAY_MS);
}

/**
 * 根据当前检索词更新资源、分类索引和结果状态。
 *
 * @param {string} query 检索词。
 * @param {boolean} immediateStatus 是否立即更新状态。
 * @returns {void}
 */
function updateDirectory(query, immediateStatus = false) {
    const needle = normalizeSearchText(query);
    const categories = document.querySelectorAll('[data-resource-category]');
    let visibleCategoryCount = 0;
    let visibleResourceCount = 0;

    document.querySelectorAll('[data-search-field]').forEach((field) => {
        highlightText(field, query);
    });

    categories.forEach((category) => {
        const categoryId = category.dataset.resourceCategory;
        const entries = category.querySelectorAll('[data-resource-entry]');
        let categoryResourceCount = 0;

        entries.forEach((entry) => {
            const isVisible = matchesSearch(entry.dataset.searchText ?? '', query);
            entry.hidden = !isVisible;
            if (isVisible) categoryResourceCount += 1;
        });

        const isCategoryVisible = categoryResourceCount > 0;
        category.hidden = !isCategoryVisible;
        if (isCategoryVisible) {
            visibleCategoryCount += 1;
            visibleResourceCount += categoryResourceCount;
        }

        const categoryCount = category.querySelector('[data-category-count]');
        if (categoryCount) categoryCount.textContent = `${categoryResourceCount} 项`;

        const navItem = document.querySelector(`[data-category-nav-item="${categoryId}"]`);
        if (navItem) {
            navItem.hidden = !isCategoryVisible;
            const navCount = navItem.querySelector('[data-category-nav-count]');
            if (navCount) navCount.textContent = String(categoryResourceCount);
        }
    });

    const hasQuery = needle.length > 0;
    elements.clearButton.hidden = !hasQuery;
    elements.noResults.hidden = visibleResourceCount > 0 || !hasQuery;

    const message = createResultMessage(visibleResourceCount, visibleCategoryCount, hasQuery);
    announceStatus(message, immediateStatus);
}

/**
 * 清除检索词并恢复完整目录。
 *
 * @returns {void}
 */
function clearSearch() {
    elements.searchInput.value = '';
    elements.searchInput.focus({ preventScroll: true });
    updateDirectory('', true);
}

/**
 * 判断用户是否要求减少非必要的滚动动画。
 *
 * @returns {boolean} 系统启用减少动态效果时返回 true。
 */
function prefersReducedMotion() {
    return typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 处理分类索引导航，并以替换方式更新锚点地址。
 *
 * @param {MouseEvent} event 分类索引的点击事件。
 * @returns {void}
 * @note 目标不存在或已隐藏时阻止跳转，避免产生无效历史记录。
 */
function handleCategoryNavigation(event) {
    if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
    ) return;

    if (!(event.target instanceof Element)) return;

    const link = event.target.closest('a[href^="#category-"]');
    if (!(link instanceof HTMLAnchorElement) || !elements.categoryNav.contains(link)) return;

    event.preventDefault();

    const targetId = link.hash.slice(1);
    const target = document.getElementById(targetId);
    if (!target || target.hidden) {
        console.warn('分类导航失败：目标区域不存在或当前不可见');
        return;
    }

    target.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start'
    });

    try {
        replaceCategoryHistory(window.history, window.location.href, targetId);
    } catch (error) {
        console.warn('分类地址更新失败，已保持当前地址：', error);
    }
}

/**
 * 初始化资源目录交互事件。
 *
 * @returns {void}
 * @note 页面节点缺失时仅记录错误，不影响页面其余内容。
 */
function initCollection() {
    if (!hasRequiredElements()) {
        console.error('资源目录初始化失败：页面节点不完整');
        return;
    }

    elements.form.addEventListener('submit', (event) => event.preventDefault());
    elements.categoryNav.addEventListener('click', handleCategoryNavigation);

    const totalCount = Number.parseInt(elements.directory.dataset.totalCount ?? '0', 10);
    if (!Number.isFinite(totalCount) || totalCount <= 0) return;

    elements.searchInput.addEventListener('input', () => {
        updateDirectory(elements.searchInput.value);
    });
    elements.clearButton.addEventListener('click', clearSearch);
    elements.clearEmptyButton.addEventListener('click', clearSearch);
    updateDirectory(elements.searchInput.value, true);
}

initCollection();
