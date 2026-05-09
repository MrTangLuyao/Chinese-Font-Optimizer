# 中文字体优化

一个 Chrome 扩展。把所有网站的中文（CJK）字符替换成你选定的中文字体，**拉丁字母完全不动，保持网站原有字体**。点击工具栏图标可一键切换字体或在当前网站禁用。

| 字体 | 来源 | 默认 |
|------|--------|---------|
| HarmonyOS Sans | 华为 | ✓ |
| OPPO Sans | OPPO | |
| MiSans | 小米 | |

## 工作原理：只替换中文

每个字体通过 `@font-face` 声明并附带 `unicode-range`，只覆盖 CJK 字符范围（U+2E80–9FFF、U+3000–303F、U+FF00–FFEF 等）。注入的覆盖规则是：

```css
* { font-family: '__cn_font_optimizer_face__', <网站原 body 字体> !important; }
```

浏览器逐字符选字逻辑：

- **CJK 字符** → 我的字体匹配 unicode-range → 用选中的中文字体 ✓
- **拉丁字符** → 我的字体不在 range 内 → fallback 到网站原 body 字体 ✓

注入前会先读一次 `body` 的 computed `font-family` 缓存起来，作为后续所有 fallback 链的基础。这样切换字体或开关时，"原字体"信息不会被自己污染。

### 已知妥协（CJK 字体扩展通病）

网站给单个元素单独指定的字体（例如 `h1 { font-family: Georgia }`）在拉丁字符上会被替换成 body 的字体，不再是 Georgia。要 100% 保留每个元素的字体得用 JS 遍历 DOM，性能代价大且会和 React/Vue 的 re-render 打架，所以我没做。

代码块（`<pre>`、`<code>`、`<kbd>`、`<samp>`、`<tt>` 及其所有子元素）和在线编辑器（Monaco、CodeMirror 5/6）通过 `:not()` 排除掉，不被覆盖，等宽字体得以保留。代价是代码块里的中文（如注释）会落到系统默认中文字体上。

图标字体类（Font Awesome、Material Icons、glyphicon、codicon、`<i>`、`<svg>`）也通过 `:not()` 排除，避免把图标变成方块字。

## 文件结构

```
src/
  manifest.json          MV3 配置，action.default_popup=popup.html，权限 storage + activeTab
  content.js             读字体选择和禁用列表，注入 @font-face + * 覆盖
  popup.html             弹出 UI（M3 Switch + 三张字体卡片，dark 主题）
  popup.js               读写 chrome.storage.sync，乐观 UI 更新
  LICENSE.txt            HarmonyOS Sans Free Font License（与字体一同分发）
  fonts/
    HarmonyOS-Regular.ttf  (8 MB, weight 400)
    HarmonyOS-Bold.ttf     (8 MB, weight 700)
    OppoSans-Regular.ttf   (10 MB, weight 400)
    OppoSans-Bold.ttf      (10 MB, weight 700)
    MiSans-Regular.woff2   (4.7 MB, weight 400)
    MiSans-Bold.woff2      (5 MB, weight 700)

HarmonyOS Sans/  Oppo Sans/  MiSans/   原始字体素材（不打包进扩展）
all_harmonybrains.crx                   打包好的 CRX（约 33 MB）
all_harmonybrains.pem                   签名密钥 —— 务必保留，重打包时用它保持扩展 ID 不变
pack.ps1                                重打包脚本
```

每种字体只装 Regular（400）+ Bold（700）。CSS 要求 300 / 500 / 900 等其他字重时浏览器会从这俩自动合成。

## 安装

**推荐方式 —— 加载已解压的扩展程序**（Chrome 从去年开始默认拒绝商店外的 CRX）：

1. 打开 `chrome://extensions`，右上角开启 **开发者模式**
2. 点 **加载已解压的扩展程序**，选择 `src/` 文件夹
3. 点击工具栏右侧的拼图图标，把 **中文字体优化** Pin 到工具栏
4. 任何时候点工具栏上的图标都能切换字体或在当前网站禁用

## 弹出 UI 操作

- **顶部站点开关**：Material 3 风格的 Switch，控制当前域名是否启用扩展。关掉后下方字体卡片会变灰，且当前页面立即移除注入的样式。
- **字体卡片**：点哪张就切到哪个字体。所有打开的标签页通过 `chrome.storage.onChanged` 实时更新，不用刷新。
- **同步**：选择和禁用列表存在 `chrome.storage.sync`，登录同账号的 Chrome 之间会同步。

## 重新打包

改完 `src/` 里的文件后：

```powershell
powershell -ExecutionPolicy Bypass -File pack.ps1
```

会复用 `all_harmonybrains.pem` 重新生成 `all_harmonybrains.crx`，扩展 ID 保持稳定。

如果你已经"加载已解压"装过，编辑完源文件直接去 `chrome://extensions` 点扩展卡片上的 🔄 **重新加载** 按钮就行，不用重打包。

## 添加更多字重 / 字体

**给现有字体加字重**：
1. 把字体文件丢进 `src/fonts/`
2. 在 `content.js` 的 `FONTS[<key>].faces` 数组里加一行
3. 跑 `pack.ps1`

每个简体中文字重 5–10 MB，按需添加。

**加第四种字体**：
1. 把它的 Regular / Bold（CJK 完整覆盖）放进 `src/fonts/`
2. 在 `content.js` 的 `FONTS` 对象里加一个 key
3. 在 `popup.html` 加一张卡片（同时给预览 `@font-face` 注册）
4. 重打包

## 第三方字体许可证

本扩展打包并分发以下第三方字体。所有字体均根据其各自的免费授权条款合法分发，请遵守对应的许可证使用：

### 1. HarmonyOS Sans

- **版权方**：华为技术有限公司（Huawei Technologies Co., Ltd.）
- **许可证**：HUAWEI HarmonyOS Sans Free Font License
- **许可范围**：免费用于个人及商业用途，允许子集化、再分发，要求随字体附带许可证全文
- **许可证文件**：`src/LICENSE.txt`
- **官方下载**：https://developer.huawei.com/consumer/cn/design/resource/

### 2. OPPO Sans

- **版权方**：广东欧珀移动通信有限公司（OPPO）
- **许可证**：OPPO Sans 免费授权（OPPO Font License）
- **许可范围**：免费用于个人及商业用途（包括但不限于设计、印刷、广告、视频、UI 等场景）。**禁止将字体本身作为商品销售**
- **官方说明**：https://www.coloros.com/article/A00000050
- **官方下载**：https://www.coloros.com/

### 3. MiSans

- **版权方**：北京小米移动软件有限公司（Xiaomi）
- **许可证**：MiSans 免费商用许可（MiSans License Agreement）
- **许可范围**：免费用于个人及商业用途，**禁止用于违法、侵权、商标注册及字体本身的销售**
- **官方说明**：https://hyperos.mi.com/font/zh/
- **官方下载**：https://hyperos.mi.com/font/

### 字体在本扩展中的用途

三种字体均仅作为 Web 字体（`@font-face`）注入到用户访问的网页，**不修改字体文件本身、不参与销售、不参与商标注册**，符合上述三方授权条款。

## 扩展自身的代码许可

本扩展的代码（`manifest.json`、`content.js`、`popup.html`、`popup.js`、`pack.ps1`）由 Louie 编写，可自由使用、修改、分发。

字体文件版权归各自版权方所有，请遵守上述对应的字体许可证条款。
