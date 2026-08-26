/**
 * @file collection.js
 * @brief 从本地数据文件渲染资源目录，并提供无网络请求的即时筛选。
 */

const RESOURCE_DATA_URL = 'data/resources.json';
const STATUS_ANNOUNCE_DELAY_MS = 250;
const CATEGORY_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_TYPE_LABELS = Object.freeze({
    'official-site': '官方网站',
    'official-repository': '官方仓库',
    'authorized-platform': '授权平台'
});

const directoryState = {
    categories: [],
    statusTimerId: null
};

const elements = {
    form: document.getElementById('resourceSearchForm'),
    searchInput: document.getElementById('resourceSearch'),
    clearButton: document.getElementById('clearSearch'),
    status: document.getElementById('resultStatus'),
    categoryNav: document.getElementById('categoryNav'),
    resourceList: document.getElementById('resourceList')
};

/**
 * 判断资源目录所需的页面节点是否完整。
 *
 * @returns {boolean} 所有节点都存在时返回 true。
 */
function hasRequiredElements() {
    return Object.values(elements).every(Boolean);
}

/**
 * 将未知值整理为去除首尾空白的文本。
 *
 * @param {unknown} value 待处理的值。
 * @returns {string} 合法字符串或空字符串。
 */
function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * 生成用于不区分大小写匹配的文本。
 *
 * @param {string} value 原始文本。
 * @returns {string} 标准化后的检索文本。
 */
function normalizeSearchText(value) {
    return value.trim().toLocaleLowerCase('zh-CN');
}

/**
 * 验证并标准化外部链接，仅允许 HTTP 与 HTTPS。
 *
 * @param {unknown} value 原始链接值。
 * @returns {URL|null} 合法链接对象或 null。
 */
function parseExternalUrl(value) {
    const text = normalizeText(value);
    if (!text) return null;

    try {
        const url = new URL(text);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
    } catch {
        return null;
    }
}

/**
 * 判断日期是否为真实的 YYYY-MM-DD 日期。
 *
 * @param {unknown} value 日期值。
 * @returns {boolean} 日期格式和日期本身都有效时返回 true。
 */
function isValidDate(value) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;

    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * 清理资源数据，避免单条异常数据中止整个目录。
 *
 * @param {unknown} rawData 从 JSON 读取的原始数据。
 * @returns {Array<Object>} 可安全渲染的分类列表。
 * @throws {TypeError} 顶层数据结构不正确时抛出异常。
 */
function normalizeResourceData(rawData) {
    if (!rawData || typeof rawData !== 'object' || !Array.isArray(rawData.categories)) {
        throw new TypeError('资源数据缺少 categories 数组');
    }

    const categoryIds = new Set();
    const resourceUrls = new Set();
    const categories = [];

    rawData.categories.forEach((category, categoryIndex) => {
        const id = normalizeText(category?.id);
        const name = normalizeText(category?.name);

        if (!CATEGORY_ID_PATTERN.test(id) || !name || !Array.isArray(category?.resources) || categoryIds.has(id)) {
            console.warn(`已跳过无效分类：索引 ${categoryIndex}`);
            return;
        }

        categoryIds.add(id);
        const resources = [];

        category.resources.forEach((resource, resourceIndex) => {
            const resourceName = normalizeText(resource?.name);
            const description = normalizeText(resource?.description);
            const sourceType = normalizeText(resource?.sourceType);
            const url = parseExternalUrl(resource?.url);
            const lastChecked = normalizeText(resource?.lastChecked);

            const isValid = resourceName
                && description
                && url
                && Object.hasOwn(SOURCE_TYPE_LABELS, sourceType)
                && isValidDate(lastChecked)
                && !resourceUrls.has(url.href);

            if (!isValid) {
                console.warn(`已跳过无效资源：分类 ${id}，索引 ${resourceIndex}`);
                return;
            }

            resourceUrls.add(url.href);
            resources.push({
                name: resourceName,
                url: url.href,
                domain: url.hostname.replace(/^www\./, ''),
                description,
                sourceType,
                lastChecked
            });
        });

        categories.push({ id, name, resources });
    });

    return categories;
}

/**
 * 在保留纯文本渲染的前提下标记匹配内容。
 *
 * @param {HTMLElement} target 接收文本的元素。
 * @param {string} text 原始文本。
 * @param {string} query 检索词。
 * @returns {void}
 */
function appendHighlightedText(target, text, query) {
    const needle = normalizeSearchText(query);
    if (!needle) {
        target.textContent = text;
        return;
    }

    const searchableText = text.toLocaleLowerCase('zh-CN');
    let cursor = 0;
    let matchIndex = searchableText.indexOf(needle, cursor);

    while (matchIndex !== -1) {
        target.append(document.createTextNode(text.slice(cursor, matchIndex)));
        const mark = document.createElement('mark');
        mark.textContent = text.slice(matchIndex, matchIndex + needle.length);
        target.append(mark);
        cursor = matchIndex + needle.length;
        matchIndex = searchableText.indexOf(needle, cursor);
    }

    target.append(document.createTextNode(text.slice(cursor)));
}

/**
 * 根据检索词筛选分类和资源，同时保留原始排序。
 *
 * @param {Array<Object>} categories 完整分类列表。
 * @param {string} query 检索词。
 * @returns {Array<Object>} 仅含匹配资源的分类列表。
 */
function filterCategories(categories, query) {
    const needle = normalizeSearchText(query);

    return categories
        .map((category) => {
            const categoryMatches = normalizeSearchText(category.name).includes(needle);
            const resources = category.resources.filter((resource) => {
                if (!needle || categoryMatches) return true;

                const searchable = [
                    resource.name,
                    resource.description,
                    resource.domain,
                    SOURCE_TYPE_LABELS[resource.sourceType]
                ].join(' ');

                return normalizeSearchText(searchable).includes(needle);
            });

            return { ...category, resources };
        })
        .filter((category) => category.resources.length > 0);
}

/**
 * 创建一个资源外链行。
 *
 * @param {Object} resource 资源数据。
 * @param {string} query 当前检索词。
 * @returns {HTMLAnchorElement} 可直接插入页面的资源链接。
 */
function createResourceEntry(resource, query) {
    const link = document.createElement('a');
    link.className = 'resource-entry';
    link.href = resource.url;
    link.target = '_blank';
    link.rel = 'external nofollow noopener noreferrer';

    const name = document.createElement('h3');
    name.className = 'resource-entry__name';
    appendHighlightedText(name, resource.name, query);

    const arrow = document.createElement('span');
    arrow.className = 'resource-entry__arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    name.append(arrow);

    const newWindowText = document.createElement('span');
    newWindowText.className = 'visually-hidden';
    newWindowText.textContent = '（在新窗口打开）';
    name.append(newWindowText);

    const description = document.createElement('p');
    description.className = 'resource-entry__description';
    appendHighlightedText(description, resource.description, query);

    const metadata = document.createElement('p');
    metadata.className = 'resource-entry__meta';

    const domain = document.createElement('span');
    domain.className = 'resource-entry__domain';
    appendHighlightedText(domain, resource.domain, query);

    const sourceType = document.createElement('span');
    sourceType.textContent = SOURCE_TYPE_LABELS[resource.sourceType];

    metadata.append(domain, sourceType);
    link.append(name, description, metadata);
    return link;
}

/**
 * 创建一个资源分类区块。
 *
 * @param {Object} category 分类数据。
 * @param {string} query 当前检索词。
 * @returns {HTMLElement} 分类区块。
 */
function createCategorySection(category, query) {
    const section = document.createElement('section');
    section.className = 'resource-category';
    section.id = `category-${category.id}`;

    const header = document.createElement('header');
    header.className = 'resource-category__header';

    const title = document.createElement('h2');
    title.textContent = category.name;

    const count = document.createElement('span');
    count.className = 'resource-category__count';
    count.textContent = `${category.resources.length} 项`;

    header.append(title, count);
    section.append(header);

    category.resources.forEach((resource) => {
        section.append(createResourceEntry(resource, query));
    });

    return section;
}

/**
 * 创建分类索引链接。
 *
 * @param {Object} category 分类数据。
 * @returns {HTMLLIElement} 分类索引条目。
 */
function createCategoryNavItem(category) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#category-${category.id}`;

    const name = document.createElement('span');
    name.textContent = category.name;

    const count = document.createElement('span');
    count.className = 'category-index__count';
    count.textContent = String(category.resources.length);

    link.append(name, count);
    item.append(link);
    return item;
}

/**
 * 创建目录的空内容或错误状态。
 *
 * @param {Object} options 状态展示参数。
 * @returns {HTMLElement} 状态区块。
 */
function createResourceState({ tone = 'neutral', title, copy, actionLabel, actionHref, onAction }) {
    const state = document.createElement('section');
    state.className = 'resource-state';
    state.dataset.tone = tone;

    const heading = document.createElement('h2');
    heading.className = 'resource-state__title';
    heading.textContent = title;

    const description = document.createElement('p');
    description.className = 'resource-state__copy';
    description.textContent = copy;

    state.append(heading, description);

    if (actionHref) {
        const action = document.createElement('a');
        action.className = 'resource-state__action';
        action.href = actionHref;
        action.textContent = actionLabel;
        state.append(action);
    } else if (onAction) {
        const action = document.createElement('button');
        action.className = 'resource-state__action';
        action.type = 'button';
        action.textContent = actionLabel;
        action.addEventListener('click', onAction);
        state.append(action);
    }

    return state;
}

/**
 * 延迟更新读屏状态，避免输入过程中产生密集播报。
 *
 * @param {string} message 待播报的信息。
 * @param {boolean} immediate 是否立即更新。
 * @returns {void}
 */
function announceStatus(message, immediate = false) {
    if (directoryState.statusTimerId !== null) {
        window.clearTimeout(directoryState.statusTimerId);
        directoryState.statusTimerId = null;
    }

    if (immediate) {
        elements.status.textContent = message;
        return;
    }

    directoryState.statusTimerId = window.setTimeout(() => {
        directoryState.statusTimerId = null;
        elements.status.textContent = message;
    }, STATUS_ANNOUNCE_DELAY_MS);
}

/**
 * 根据当前检索词重绘资源目录。
 *
 * @param {string} query 检索词。
 * @param {boolean} immediateStatus 是否立即更新状态信息。
 * @returns {void}
 */
function renderDirectory(query, immediateStatus = false) {
    const filteredCategories = filterCategories(directoryState.categories, query);
    const visibleCount = filteredCategories.reduce((total, category) => total + category.resources.length, 0);
    const hasQuery = normalizeSearchText(query).length > 0;

    elements.categoryNav.replaceChildren();
    elements.resourceList.replaceChildren();
    elements.clearButton.hidden = !hasQuery;

    if (visibleCount === 0) {
        const state = hasQuery
            ? createResourceState({
                title: '没有匹配的收录',
                copy: '换一个名称、分类或说明试试，或清除当前搜索。',
                actionLabel: '清除搜索',
                onAction: clearSearch
            })
            : createResourceState({
                title: '暂未收录资源',
                copy: '目录结构已经准备好，后续资源会按分类整理在这里。',
                actionLabel: '推荐资源',
                actionHref: 'mailto:imzou.ht@outlook.com?subject=Collection%20资源推荐'
            });

        elements.resourceList.append(state);
        announceStatus(hasQuery ? '没有找到匹配资源。' : '当前没有可显示的资源。', immediateStatus);
        return;
    }

    const navFragment = document.createDocumentFragment();
    const listFragment = document.createDocumentFragment();

    filteredCategories.forEach((category) => {
        navFragment.append(createCategoryNavItem(category));
        listFragment.append(createCategorySection(category, query));
    });

    elements.categoryNav.append(navFragment);
    elements.resourceList.append(listFragment);

    const message = hasQuery
        ? `找到 ${visibleCount} 项资源，分布在 ${filteredCategories.length} 个分类。`
        : `已收录 ${visibleCount} 项资源，分布在 ${filteredCategories.length} 个分类。`;
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
    renderDirectory('', true);
}

/**
 * 从同源本地 JSON 文件加载资源目录。
 *
 * @returns {Promise<void>}
 * @note 加载失败时只在页面内显示可恢复状态，不弹出对话框。
 */
async function loadResources() {
    elements.searchInput.disabled = true;
    elements.resourceList.setAttribute('aria-busy', 'true');
    announceStatus('正在读取收录…', true);

    try {
        const response = await fetch(RESOURCE_DATA_URL, {
            credentials: 'same-origin',
            cache: 'default'
        });

        if (!response.ok) {
            throw new Error(`资源请求失败：HTTP ${response.status}`);
        }

        directoryState.categories = normalizeResourceData(await response.json());
        elements.searchInput.disabled = false;
        elements.resourceList.setAttribute('aria-busy', 'false');
        renderDirectory(elements.searchInput.value, true);
    } catch (error) {
        console.error('资源目录加载失败：', error);
        elements.categoryNav.replaceChildren();
        elements.resourceList.replaceChildren(createResourceState({
            tone: 'error',
            title: '资源目录未能读取',
            copy: '请刷新页面；如果你正在本地查看，请通过本地服务器打开网站。',
            actionLabel: '重新加载',
            onAction: loadResources
        }));
        elements.resourceList.setAttribute('aria-busy', 'false');
        announceStatus('资源目录未能读取。', true);
    }
}

/**
 * 初始化资源目录事件与数据加载。
 *
 * @returns {void}
 */
function initCollection() {
    if (!hasRequiredElements()) {
        console.error('资源目录初始化失败：页面节点不完整');
        return;
    }

    elements.form.addEventListener('submit', (event) => event.preventDefault());
    elements.searchInput.addEventListener('input', () => {
        renderDirectory(elements.searchInput.value);
    });
    elements.clearButton.addEventListener('click', clearSearch);
    loadResources();
}

initCollection();
