/**
 * @file content.config.ts
 * @brief 定义资源收录内容集合及其构建期校验规则。
 */

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import categoryFile from './data/categories.json';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORY_IDS = new Set(categoryFile.categories.map((category) => category.id));

if (CATEGORY_IDS.size !== categoryFile.categories.length) {
    throw new Error('资源分类 ID 存在重复项。');
}

/**
 * 判断日期是否为真实的 YYYY-MM-DD 日期。
 *
 * @param value 待校验的日期文本。
 * @returns 日期格式和日期值均有效时返回 true。
 */
function isValidDate(value: string): boolean {
    if (!DATE_PATTERN.test(value)) return false;

    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * 判断链接是否使用允许的 HTTP 协议。
 *
 * @param value 待校验的链接文本。
 * @returns 链接有效且使用 HTTP 或 HTTPS 时返回 true。
 */
function isAllowedUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

const resources = defineCollection({
    loader: glob({ pattern: '*.json', base: './src/data/resources' }),
    schema: z.object({
        $schema: z.string().optional(),
        name: z.string().trim().min(1).max(80),
        url: z.string().refine(isAllowedUrl, '必须是有效的 HTTP 或 HTTPS 地址'),
        description: z.string().trim().min(1).max(200),
        category: z.string().refine((value) => CATEGORY_IDS.has(value), '必须引用已定义的分类'),
        order: z.number().int().nonnegative(),
        sourceType: z.enum([
            'official-site',
            'official-repository',
            'authorized-platform',
            'third-party-site'
        ]),
        lastChecked: z.string().refine(isValidDate, '必须是真实的 YYYY-MM-DD 日期')
    })
});

export const collections = { resources };
