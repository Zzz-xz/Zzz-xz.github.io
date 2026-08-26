/**
 * @file validate-resources.mjs
 * @brief 在提交前校验资源分类、字段、链接和重复项。
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RESOURCE_FILE_URL = new URL('../data/resources.json', import.meta.url);
const CATEGORY_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_TYPES = new Set([
    'official-site',
    'official-repository',
    'authorized-platform'
]);

/**
 * 判断值是否为普通对象。
 *
 * @param {unknown} value 待判断的值。
 * @returns {boolean} 普通对象返回 true。
 */
function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 判断日期是否为真实的 YYYY-MM-DD 日期。
 *
 * @param {unknown} value 日期值。
 * @returns {boolean} 日期有效时返回 true。
 */
function isValidDate(value) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;

    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * 验证外部链接并返回标准化地址。
 *
 * @param {unknown} value 链接值。
 * @returns {string|null} 合法地址或 null。
 */
function normalizeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;

    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
}

/**
 * 校验资源数据并返回全部问题。
 *
 * @param {unknown} data 资源数据。
 * @returns {{errors: string[], categoryCount: number, resourceCount: number}} 校验结果。
 */
export function validateResources(data) {
    const errors = [];
    const categoryIds = new Set();
    const resourceUrls = new Set();
    let resourceCount = 0;

    if (!isObject(data) || !Array.isArray(data.categories)) {
        return { errors: ['顶层必须包含 categories 数组。'], categoryCount: 0, resourceCount: 0 };
    }

    data.categories.forEach((category, categoryIndex) => {
        const categoryPath = `categories[${categoryIndex}]`;
        if (!isObject(category)) {
            errors.push(`${categoryPath} 必须是对象。`);
            return;
        }

        if (typeof category.id !== 'string' || !CATEGORY_ID_PATTERN.test(category.id)) {
            errors.push(`${categoryPath}.id 必须使用小写字母、数字和连字符，并以字母开头。`);
        } else if (categoryIds.has(category.id)) {
            errors.push(`${categoryPath}.id 与已有分类重复：${category.id}`);
        } else {
            categoryIds.add(category.id);
        }

        if (typeof category.name !== 'string' || !category.name.trim()) {
            errors.push(`${categoryPath}.name 不能为空。`);
        }

        if (!Array.isArray(category.resources)) {
            errors.push(`${categoryPath}.resources 必须是数组。`);
            return;
        }

        category.resources.forEach((resource, resourceIndex) => {
            const resourcePath = `${categoryPath}.resources[${resourceIndex}]`;
            resourceCount += 1;

            if (!isObject(resource)) {
                errors.push(`${resourcePath} 必须是对象。`);
                return;
            }

            for (const field of ['name', 'description']) {
                if (typeof resource[field] !== 'string' || !resource[field].trim()) {
                    errors.push(`${resourcePath}.${field} 不能为空。`);
                }
            }

            const normalizedUrl = normalizeUrl(resource.url);
            if (!normalizedUrl) {
                errors.push(`${resourcePath}.url 必须是有效的 HTTP 或 HTTPS 地址。`);
            } else if (resourceUrls.has(normalizedUrl)) {
                errors.push(`${resourcePath}.url 与已有资源重复：${normalizedUrl}`);
            } else {
                resourceUrls.add(normalizedUrl);
            }

            if (!SOURCE_TYPES.has(resource.sourceType)) {
                errors.push(`${resourcePath}.sourceType 不是允许的来源类型。`);
            }

            if (!isValidDate(resource.lastChecked)) {
                errors.push(`${resourcePath}.lastChecked 必须是真实的 YYYY-MM-DD 日期。`);
            }
        });
    });

    return {
        errors,
        categoryCount: data.categories.length,
        resourceCount
    };
}

/**
 * 读取并校验资源文件。
 *
 * @returns {Promise<void>}
 */
async function main() {
    try {
        const content = await readFile(RESOURCE_FILE_URL, 'utf8');
        const result = validateResources(JSON.parse(content));

        if (result.errors.length > 0) {
            result.errors.forEach((error) => console.error(`- ${error}`));
            process.exitCode = 1;
            return;
        }

        console.log(`资源数据有效：${result.categoryCount} 个分类，${result.resourceCount} 条资源。`);
    } catch (error) {
        console.error(`资源文件无法读取：${error.message}`);
        process.exitCode = 1;
    }
}

const isDirectRun = process.argv[1]
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
    await main();
}
