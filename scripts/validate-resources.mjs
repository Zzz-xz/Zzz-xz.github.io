/**
 * @file validate-resources.mjs
 * @brief 在构建前校验资源分类、独立资源文件、链接和重复项。
 */

import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CATEGORY_FILE_URL = new URL('../src/data/categories.json', import.meta.url);
const RESOURCE_DIRECTORY_URL = new URL('../src/data/resources/', import.meta.url);
const CATEGORY_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const RESOURCE_FILE_PATTERN = /^[a-z][a-z0-9-]*\.json$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_TYPES = new Set([
    'official-site',
    'official-repository',
    'authorized-platform'
]);
const CATEGORY_FIELDS = new Set(['id', 'name', 'order']);
const RESOURCE_FIELDS = new Set([
    '$schema',
    'name',
    'url',
    'description',
    'category',
    'order',
    'sourceType',
    'lastChecked'
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
 * 检查对象是否包含未声明字段。
 *
 * @param {Record<string, unknown>} value 待检查对象。
 * @param {Set<string>} allowedFields 允许的字段集合。
 * @param {string} path 用于错误提示的数据路径。
 * @param {string[]} errors 错误列表。
 * @returns {void}
 */
function validateAllowedFields(value, allowedFields, path, errors) {
    for (const field of Object.keys(value)) {
        if (!allowedFields.has(field)) errors.push(`${path}.${field} 不是允许的字段。`);
    }
}

/**
 * 校验分类文件并返回有效分类 ID。
 *
 * @param {unknown} data 分类文件内容。
 * @param {string[]} errors 错误列表。
 * @returns {Set<string>} 已声明的分类 ID。
 */
function validateCategories(data, errors) {
    const categoryIds = new Set();

    if (!isObject(data) || !Array.isArray(data.categories)) {
        errors.push('分类文件必须包含 categories 数组。');
        return categoryIds;
    }

    data.categories.forEach((category, index) => {
        const path = `categories[${index}]`;
        if (!isObject(category)) {
            errors.push(`${path} 必须是对象。`);
            return;
        }

        validateAllowedFields(category, CATEGORY_FIELDS, path, errors);

        if (typeof category.id !== 'string' || !CATEGORY_ID_PATTERN.test(category.id)) {
            errors.push(`${path}.id 必须使用小写字母、数字和连字符，并以字母开头。`);
        } else if (categoryIds.has(category.id)) {
            errors.push(`${path}.id 与已有分类重复：${category.id}`);
        } else {
            categoryIds.add(category.id);
        }

        if (typeof category.name !== 'string' || !category.name.trim() || category.name.length > 30) {
            errors.push(`${path}.name 必须是 1 至 30 个字符。`);
        }

        if (!Number.isInteger(category.order) || category.order < 0) {
            errors.push(`${path}.order 必须是非负整数。`);
        }
    });

    return categoryIds;
}

/**
 * 校验一个独立资源文件。
 *
 * @param {string} fileName 资源文件名。
 * @param {unknown} resource 资源文件内容。
 * @param {Set<string>} categoryIds 已声明分类 ID。
 * @param {Set<string>} resourceUrls 已使用链接集合。
 * @param {string[]} errors 错误列表。
 * @returns {void}
 */
function validateResource(fileName, resource, categoryIds, resourceUrls, errors) {
    const path = `resources/${fileName}`;

    if (!RESOURCE_FILE_PATTERN.test(fileName)) {
        errors.push(`${path} 文件名必须使用小写字母、数字和连字符。`);
    }

    if (!isObject(resource)) {
        errors.push(`${path} 必须包含一个对象。`);
        return;
    }

    validateAllowedFields(resource, RESOURCE_FIELDS, path, errors);

    if (typeof resource.name !== 'string' || !resource.name.trim() || resource.name.length > 80) {
        errors.push(`${path}.name 必须是 1 至 80 个字符。`);
    }

    if (typeof resource.description !== 'string' || !resource.description.trim() || resource.description.length > 200) {
        errors.push(`${path}.description 必须是 1 至 200 个字符。`);
    }

    const normalizedUrl = normalizeUrl(resource.url);
    if (!normalizedUrl) {
        errors.push(`${path}.url 必须是有效的 HTTP 或 HTTPS 地址。`);
    } else if (resourceUrls.has(normalizedUrl)) {
        errors.push(`${path}.url 与已有资源重复：${normalizedUrl}`);
    } else {
        resourceUrls.add(normalizedUrl);
    }

    if (typeof resource.category !== 'string' || !categoryIds.has(resource.category)) {
        errors.push(`${path}.category 必须引用已定义的分类。`);
    }

    if (!Number.isInteger(resource.order) || resource.order < 0) {
        errors.push(`${path}.order 必须是非负整数。`);
    }

    if (!SOURCE_TYPES.has(resource.sourceType)) {
        errors.push(`${path}.sourceType 不是允许的来源类型。`);
    }

    if (!isValidDate(resource.lastChecked)) {
        errors.push(`${path}.lastChecked 必须是真实的 YYYY-MM-DD 日期。`);
    }
}

/**
 * 读取并校验完整资源目录。
 *
 * @returns {Promise<{errors: string[], categoryCount: number, resourceCount: number}>} 校验结果。
 */
export async function validateCatalog() {
    const errors = [];
    const categoryData = JSON.parse(await readFile(CATEGORY_FILE_URL, 'utf8'));
    const categoryIds = validateCategories(categoryData, errors);
    const directoryPath = fileURLToPath(RESOURCE_DIRECTORY_URL);
    const fileNames = (await readdir(directoryPath))
        .filter((fileName) => fileName.endsWith('.json'))
        .sort();
    const resourceUrls = new Set();

    for (const fileName of fileNames) {
        try {
            const fileUrl = new URL(fileName, RESOURCE_DIRECTORY_URL);
            const resource = JSON.parse(await readFile(fileUrl, 'utf8'));
            validateResource(fileName, resource, categoryIds, resourceUrls, errors);
        } catch (error) {
            errors.push(`resources/${fileName} 无法读取：${error.message}`);
        }
    }

    return {
        errors,
        categoryCount: categoryIds.size,
        resourceCount: fileNames.length
    };
}

/**
 * 执行命令行校验并设置退出码。
 *
 * @returns {Promise<void>}
 */
async function main() {
    try {
        const result = await validateCatalog();

        if (result.errors.length > 0) {
            result.errors.forEach((error) => console.error(`- ${error}`));
            process.exitCode = 1;
            return;
        }

        console.log(`资源数据有效：${result.categoryCount} 个分类，${result.resourceCount} 条资源。`);
    } catch (error) {
        console.error(`资源目录无法校验：${error.message}`);
        process.exitCode = 1;
    }
}

const isDirectRun = process.argv[1]
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
    await main();
}
