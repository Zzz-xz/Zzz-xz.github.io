/**
 * @file search.js
 * @brief 提供资源目录搜索所需的纯文本匹配与状态文案。
 */

/**
 * 生成用于不区分大小写匹配的文本。
 *
 * @param {string} value 原始文本。
 * @returns {string} 标准化后的检索文本。
 */
export function normalizeSearchText(value) {
    return value.trim().toLocaleLowerCase('zh-CN');
}

/**
 * 判断资源检索索引是否匹配当前查询。
 *
 * @param {string} searchText 资源的完整检索索引。
 * @param {string} query 用户输入的查询。
 * @returns {boolean} 空查询或内容匹配时返回 true。
 */
export function matchesSearch(searchText, query) {
    const needle = normalizeSearchText(query);
    return !needle || normalizeSearchText(searchText).includes(needle);
}

/**
 * 生成资源筛选结果状态文案。
 *
 * @param {number} resourceCount 当前可见资源数量。
 * @param {number} categoryCount 当前可见分类数量。
 * @param {boolean} hasQuery 是否存在有效查询。
 * @returns {string} 可直接用于页面与读屏播报的状态文案。
 */
export function createResultMessage(resourceCount, categoryCount, hasQuery) {
    if (hasQuery && resourceCount === 0) return '没有找到匹配资源。';
    if (hasQuery) return `找到 ${resourceCount} 项资源，分布在 ${categoryCount} 个分类。`;
    return `已收录 ${resourceCount} 项资源，分布在 ${categoryCount} 个分类。`;
}
