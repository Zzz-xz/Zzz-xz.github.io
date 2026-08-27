/**
 * @file catalog.ts
 * @brief 将资源内容集合整理为页面可直接渲染的分类目录。
 */

import type { CollectionEntry } from 'astro:content';

export const SOURCE_TYPE_LABELS = Object.freeze({
    'official-site': '项目官网',
    'official-repository': '官方仓库',
    'authorized-platform': '授权平台',
    'third-party-site': '第三方网站'
});

export interface CategoryDefinition {
    id: string;
    name: string;
    order: number;
}

export type CatalogResource = CollectionEntry<'resources'>['data'] & {
    id: string;
    domain: string;
    sourceLabel: string;
    searchText: string;
};

export interface CatalogCategory extends CategoryDefinition {
    resources: CatalogResource[];
}

/**
 * 从外部链接中提取适合展示的域名。
 *
 * @param value 已通过内容集合校验的资源地址。
 * @returns 去除 www 前缀后的域名。
 */
function getDisplayDomain(value: string): string {
    return new URL(value).hostname.replace(/^www\./, '');
}

/**
 * 生成供浏览器本地筛选使用的纯文本索引。
 *
 * @param categoryName 分类显示名称。
 * @param resource 已通过内容集合校验的资源数据。
 * @param domain 资源链接域名。
 * @param sourceLabel 来源类型显示文本。
 * @returns 包含可搜索字段的文本。
 */
function createSearchText(
    categoryName: string,
    resource: CollectionEntry<'resources'>['data'],
    domain: string,
    sourceLabel: string
): string {
    return [categoryName, resource.name, resource.description, domain, sourceLabel].join(' ');
}

/**
 * 按分类与配置顺序构建资源目录，并跳过暂时为空的分类。
 *
 * @param definitions 分类定义列表。
 * @param entries Astro 读取并校验后的资源条目。
 * @returns 可直接供页面渲染的非空分类列表。
 */
export function buildCatalog(
    definitions: CategoryDefinition[],
    entries: CollectionEntry<'resources'>[]
): CatalogCategory[] {
    const resourcesByCategory = new Map<string, CatalogResource[]>();

    for (const entry of entries) {
        const domain = getDisplayDomain(entry.data.url);
        const sourceLabel = SOURCE_TYPE_LABELS[entry.data.sourceType];
        const categoryName = definitions.find((category) => category.id === entry.data.category)?.name ?? '';
        const resource: CatalogResource = {
            id: entry.id,
            ...entry.data,
            domain,
            sourceLabel,
            searchText: createSearchText(categoryName, entry.data, domain, sourceLabel)
        };
        const categoryResources = resourcesByCategory.get(entry.data.category) ?? [];
        categoryResources.push(resource);
        resourcesByCategory.set(entry.data.category, categoryResources);
    }

    return [...definitions]
        .sort((first, second) => first.order - second.order)
        .map((category) => ({
            ...category,
            resources: (resourcesByCategory.get(category.id) ?? []).sort((first, second) => (
                first.order - second.order || first.name.localeCompare(second.name, 'zh-CN')
            ))
        }))
        .filter((category) => category.resources.length > 0);
}
