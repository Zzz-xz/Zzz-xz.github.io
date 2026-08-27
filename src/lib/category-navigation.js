/**
 * @file category-navigation.js
 * @brief 生成并替换资源分类锚点地址，避免同页导航堆积浏览器历史记录。
 */

const CATEGORY_TARGET_PATTERN = /^category-[a-z][a-z0-9-]*$/;

/**
 * 生成指向资源分类的完整地址，并保留当前路径与查询参数。
 *
 * @param {string} currentHref 当前页面的完整地址。
 * @param {string} targetId 分类区域的元素 ID。
 * @returns {string} 包含目标分类锚点的完整地址。
 * @throws {TypeError} 当前地址或分类 ID 无效时抛出。
 */
export function createCategoryUrl(currentHref, targetId) {
    if (typeof currentHref !== 'string' || currentHref.length === 0) {
        throw new TypeError('当前页面地址不能为空');
    }

    if (typeof targetId !== 'string' || !CATEGORY_TARGET_PATTERN.test(targetId)) {
        throw new TypeError('分类目标 ID 无效');
    }

    const url = new URL(currentHref);
    url.hash = targetId;
    return url.href;
}

/**
 * 使用替换方式更新分类锚点，确保同页分类切换不新增历史记录。
 *
 * @param {{ state: unknown, replaceState: Function }} historyApi 浏览器 History 接口。
 * @param {string} currentHref 当前页面的完整地址。
 * @param {string} targetId 分类区域的元素 ID。
 * @returns {string} 已写入地址栏的完整地址。
 * @throws {TypeError} History 接口不可用或参数无效时抛出。
 */
export function replaceCategoryHistory(historyApi, currentHref, targetId) {
    if (!historyApi || typeof historyApi.replaceState !== 'function') {
        throw new TypeError('浏览器历史记录接口不可用');
    }

    const nextHref = createCategoryUrl(currentHref, targetId);
    historyApi.replaceState(historyApi.state, '', nextHref);
    return nextHref;
}
