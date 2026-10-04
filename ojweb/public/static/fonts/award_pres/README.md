# 颁奖全屏投屏字体（Award presentation）

本目录为 **Noto Sans SC** / **Noto Serif SC** 子集（WOFF2），覆盖 **ASCII + CJK 统一表意文字 U+4E00–U+9FFF** 及常用 CJK 标点（U+3000–U+303F），用于颁奖编排全屏展示。原始字体为 **SIL Open Font License 1.1**，见根目录 `OFL.txt`。

## 重新生成子集（维护用）

需已安装 `fonttools`（`pip install fonttools brotli`），并从 Google Fonts 下载对应 TTF 后执行：

```bash
U='U+0020-007E,U+3000-303F,U+4E00-9FFF'
pyftsubset NotoSansSC-Medium.ttf  --unicodes="$U" --flavor=woff2 -o NotoSansSC-500-sub.woff2
pyftsubset NotoSansSC-Bold.ttf    --unicodes="$U" --flavor=woff2 -o NotoSansSC-700-sub.woff2
pyftsubset NotoSerifSC-Bold.ttf   --unicodes="$U" --flavor=woff2 -o NotoSerifSC-700-sub.woff2
```

TTF 可由默认 UA 请求 `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@500;700&family=Noto+Serif+SC:wght@700&display=swap` 返回的 `src` 链接获取。
