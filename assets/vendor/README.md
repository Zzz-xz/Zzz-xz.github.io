# 本地第三方资源

本目录保存网站离线运行所需的第三方资源。页面加载不依赖外部 CDN。

| 资源 | 固定版本 | 项目地址 | 本地许可证 |
| --- | --- | --- | --- |
| jQuery | 3.7.1 | https://github.com/jquery/jquery | `licenses/jquery-LICENSE.txt` |
| jquery.ripples | 0.5.3 | https://github.com/sirxemic/jquery.ripples | `licenses/jquery-ripples-LICENSE.txt` |
| Font Awesome Free | 6.4.0 | https://github.com/FortAwesome/Font-Awesome | `licenses/fontawesome-LICENSE.txt` |
| Noto Sans SC | 可变字体与页面字符子集 | https://github.com/google/fonts/tree/main/ofl/notosanssc | `licenses/noto-sans-sc-OFL.txt` |
| Noto Serif SC | 页面字符子集 | https://github.com/google/fonts/tree/main/ofl/notoserifsc | `licenses/noto-serif-sc-OFL.txt` |

更新资源时，应同步更新版本号、许可证文件和 HTML/CSS 中的本地路径，并重新执行离线加载测试。
字体子集仅覆盖当前页面文字，修改可见文案后应同步重新生成子集。
