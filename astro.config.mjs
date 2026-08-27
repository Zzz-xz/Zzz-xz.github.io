/**
 * @file astro.config.mjs
 * @brief 定义个人网站的静态构建、正式域名与目录式路由。
 */

import { defineConfig } from 'astro/config';

export default defineConfig({
    site: 'https://www.lingin.top',
    output: 'static',
    trailingSlash: 'always',
    build: {
        format: 'directory'
    }
});
