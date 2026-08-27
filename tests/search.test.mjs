/**
 * @file search.test.mjs
 * @brief 验证资源目录搜索的大小写、中文、空输入和无结果边界。
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createResultMessage, matchesSearch, normalizeSearchText } from '../src/lib/search.js';

test('空查询显示全部资源', () => {
    assert.equal(matchesSearch('软件资源 Maple Mono', '   '), true);
});

test('英文查询忽略大小写和首尾空白', () => {
    assert.equal(matchesSearch('学习 TypeWords 官方网站', '  typewords  '), true);
});

test('中文查询可以匹配分类', () => {
    assert.equal(matchesSearch('软件资源 BongoCat 官方仓库', '软件资源'), true);
});

test('无关查询不会误匹配', () => {
    assert.equal(matchesSearch('游戏资源 Gamer520 官方网站', '字体'), false);
});

test('搜索文本标准化保持中文并转换英文大小写', () => {
    assert.equal(normalizeSearchText('  Maple 字体  '), 'maple 字体');
});

test('结果状态覆盖完整、匹配和空结果', () => {
    assert.equal(createResultMessage(5, 3, false), '已收录 5 项资源，分布在 3 个分类。');
    assert.equal(createResultMessage(1, 1, true), '找到 1 项资源，分布在 1 个分类。');
    assert.equal(createResultMessage(0, 0, true), '没有找到匹配资源。');
});
