/**
 * @file category-navigation.test.mjs
 * @brief 验证分类锚点地址生成与历史记录替换行为。
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createCategoryUrl, replaceCategoryHistory } from '../src/lib/category-navigation.js';

test('分类锚点会替换旧锚点并保留查询参数', () => {
    const nextHref = createCategoryUrl(
        'https://www.lingin.top/collection/?from=home#category-learning',
        'category-software'
    );

    assert.equal(nextHref, 'https://www.lingin.top/collection/?from=home#category-software');
});

test('无效分类目标不会写入地址栏', () => {
    assert.throws(
        () => createCategoryUrl('https://www.lingin.top/collection/', '../software'),
        { name: 'TypeError', message: '分类目标 ID 无效' }
    );
});

test('分类切换只替换当前历史记录', () => {
    const calls = [];
    const historyApi = {
        state: { source: 'collection' },
        replaceState(...args) {
            calls.push(args);
        }
    };

    const nextHref = replaceCategoryHistory(
        historyApi,
        'https://www.lingin.top/collection/#category-learning',
        'category-software'
    );

    assert.equal(nextHref, 'https://www.lingin.top/collection/#category-software');
    assert.deepEqual(calls, [[
        { source: 'collection' },
        '',
        'https://www.lingin.top/collection/#category-software'
    ]]);
});
