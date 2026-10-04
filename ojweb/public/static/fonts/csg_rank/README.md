# csg_rank — 榜单体系共用字体

供 **比赛实时榜单**、**滚榜**、**外榜** 等页面自托管加载（`rank_font_faces.css`），并与 **离线滚榜导出** 一并打包。（滚榜与榜单共用本目录；**不再**维护 `static/fonts/csg_roll`。）

## 字体与许可

| 文件 | 来源 | 许可 |
|------|------|------|
| `noto-sans-sc-chinese-simplified-*-normal.woff2` | [@fontsource/noto-sans-sc](https://github.com/fontsource/font-files/tree/main/fonts/google/noto-sans-sc) | [OFL](https://openfontlicense.org/) |
| `plus-jakarta-sans-latin-*-normal.woff2` | [@fontsource/plus-jakarta-sans](https://github.com/fontsource/font-files/tree/main/fonts/google/plus-jakarta-sans) | [OFL](https://openfontlicense.org/) |

CSS 中逻辑族名：`CsgRank SC`（中文）、`CsgRank Latin`（拉丁与数字，与中文混排时由浏览器按码位回退）。

更新 woff2 时：在 **`rank_font_faces.css`** 中维护 `@font-face` 路径即可；**`RankToolExportOfflineRollPack`** 会经 **`RankToolExtractFontUrlsFromCSS(rank_font_faces.css)`** 自动打入 ZIP（**`RankToolRankUiFontFiles`** 仍保留给其它调用方作清单参考，离线导出不再依赖其与 CSS 手工双写）。
