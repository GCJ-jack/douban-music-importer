# douban-music-importer

`douban-music-importer` 是一个 Chrome Manifest V3 浏览器扩展，用于从 Discogs release 页面导入公开发行元数据，生成可审阅的豆瓣音乐草稿，并在用户已经打开的豆瓣音乐新条目详细表单上进行安全辅助填写。

项目定位是“辅助录入”，不是自动发布、自动搬运或批量创建工具。用户始终负责检查、编辑和最终提交。

## 当前状态

v0.1 主链路已实现，仍处于发布前验证阶段。

当前已支持：

- 识别 Discogs release 页面并解析 `release_id`。
- 用户主动触发后，请求单个 Discogs 官方 API release endpoint。
- 将 Discogs raw metadata 标准化为内部 release metadata。
- 映射为可审阅的 Douban draft。
- 在 popup review UI 中展示、编辑、删除、确认字段。
- 识别豆瓣音乐新条目的查询/消重页和详细表单页。
- 只在用户已经打开的豆瓣详细表单上填写安全的文本输入和 textarea 字段。
- 默认不覆盖豆瓣表单已有值。

详细执行基线见 [docs/mvp-spec.md](docs/mvp-spec.md)。

## 安装方式

Chrome 本地加载：

1. 打开 `chrome://extensions/`。
2. 开启 Developer mode。
3. 点击 Load unpacked。
4. 选择本仓库根目录。
5. 确认扩展 `Douban Music Importer` 已加载。

如果修改了本地代码，请在扩展卡片上点击刷新按钮后再测试。

## 使用流程

1. 打开一个 Discogs release 页面，例如 `https://www.discogs.com/release/123456-Artist-Album`。
2. 点击扩展 popup，确认页面被识别为支持导入，并显示正确的 `release_id`。
3. 点击“获取 Discogs 元数据”。
4. 在 review UI 中检查所有字段、来源、置信度、warnings 和未映射数据。
5. 编辑、删除并确认需要用于豆瓣填写的字段。
6. 用户自行登录豆瓣，并自行打开 `https://music.douban.com/new_subject`。
7. 如果当前是查询/消重页，插件只提示用户继续豆瓣原生流程；不会点击“下一步”或“添加无条形码的唱片”。
8. 用户手动进入详细表单后，再点击 popup 中的“准备填写豆瓣表单”。
9. 插件只填写已确认、受支持、且当前为空的安全字段。
10. 用户在豆瓣页面人工检查并自行提交。

## v0.1 支持填写的豆瓣字段

当前只填写安全 text input / textarea：

- `title` -> `#p_27`
- `artists` -> 可见的 `input[name="p_48"]`
- `releaseDate` -> `#p_51`
- `publisher` -> `#p_50`
- `discCount` / `discNumber` -> `#p_55`
- `isrc` -> `#p_54`
- `tracks` -> `textarea[name="p_52_other"]`
- `summary` -> `textarea[name="p_28_other"]`
- `externalLinks` / `reference` -> `textarea[name="p_152_other"]`

当前不自动填写：

- barcode
- 流派、专辑类型、介质等 custom selects
- coverImageUrl
- catalogNumber
- unmapped 数据

## 安全边界

本项目不会：

- 自动提交豆瓣条目。
- 点击豆瓣“下一步”“取消”或“添加无条形码的唱片”。
- 自动寻找、打开或绕过豆瓣新增条目入口。
- 负责豆瓣登录。
- 读取 cookies。
- 判断或绕过登录状态。
- 处理验证码。
- 绕过审核、限流或社区规则。
- 批量请求 Discogs API。
- 后台爬取 Discogs 或豆瓣。
- 自动上传、下载或替换封面图片。
- 默认覆盖豆瓣表单已有值。
- 收集、上传或同步用户数据。

Discogs 数据只作为草稿来源。写入豆瓣前，字段必须经过 review UI。豆瓣表单已有内容默认跳过，不会自动覆盖。

## 权限说明

当前 Manifest 使用最小权限：

- `storage`：保存当前导入的 raw metadata、review draft 和临时状态。默认使用浏览器本地/session storage，不上传、不同步。
- `activeTab`：用户打开 popup 时读取当前活动标签页，用于识别当前 Discogs release 或将已确认 payload 发送到当前豆瓣详细表单。
- `https://www.discogs.com/*` / `https://discogs.com/*`：识别用户当前打开的 Discogs release 页面。
- `https://api.discogs.com/*`：请求用户当前 release 对应的单个 Discogs 官方 API endpoint。
- `https://music.douban.com/new_subject*`：只在用户打开的豆瓣音乐新条目页面上检测和辅助填写。
- `web_accessible_resources` for `https://music.douban.com/*`：允许豆瓣 content script 动态加载扩展内的 form assistant 模块；不授予额外网页访问能力。

Manifest 不应申请：

- `cookies`
- `<all_urls>`
- `webRequest`
- `declarativeNetRequest`
- `tabs`，除非未来有明确 issue、理由和 review

更多权限和安全说明见 [docs/privacy-and-permissions.md](docs/privacy-and-permissions.md)。

## 本地验证

```bash
npm test
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

发布前手动验收见 [docs/release-checklist-v0.1.md](docs/release-checklist-v0.1.md)。

## 文档

- [docs/mvp-spec.md](docs/mvp-spec.md)：v0.1 MVP 执行基线。
- [docs/research-douban-form.md](docs/research-douban-form.md)：豆瓣新条目表单研究。
- [docs/fixtures.md](docs/fixtures.md)：回归 fixtures 和策略。
- [docs/privacy-and-permissions.md](docs/privacy-and-permissions.md)：权限和安全边界。
- [docs/release-checklist-v0.1.md](docs/release-checklist-v0.1.md)：发布前验收清单。

## 路线图

路线图见 [ROADMAP.md](ROADMAP.md)。

RYM 和 AOTY 是后续研究目标，不属于 v0.1。

## 贡献

贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。涉及权限、来源访问、字段映射、表单填写或存储的变更必须说明安全影响并补充测试。
