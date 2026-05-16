# Privacy and Permissions

本文档是 v0.1 的权限和安全 review 基线。任何扩展权限、来源访问、表单填写、存储或自动化行为变化，都应按本文档检查。

## 权限政策

当前 Manifest 使用：

- `storage`：保存当前导入流程需要的 raw metadata、review draft 和临时状态。数据只保存在用户浏览器本地或 session storage，不上传、不同步。
- `activeTab`：用户打开 popup 后读取当前活动页 URL，并在用户确认后向当前活动豆瓣详细表单发送填写请求。
- `https://www.discogs.com/*` / `https://discogs.com/*`：识别用户当前打开的 Discogs release 页面。
- `https://api.discogs.com/*`：请求当前 release ID 对应的单个 Discogs 官方 API endpoint。
- `https://music.douban.com/new_subject*`：在用户已经打开的豆瓣音乐新条目页面上检测页面状态和辅助填写。
- `web_accessible_resources` for `https://music.douban.com/*`：允许豆瓣 content script 加载扩展内的 form assistant 模块。它不表示可以访问所有豆瓣页面数据。

## 禁止权限

v0.1 不应申请：

- `cookies`
- `<all_urls>`
- `webRequest`
- `declarativeNetRequest`
- `tabs`，除非未来有明确 issue、理由和 review

任何权限扩展都必须在 PR 中说明：

- 为什么现有权限不够。
- 访问哪些页面或 API。
- 是否会扩大用户数据暴露面。
- 是否影响 no-login、no-cookie、no-submit、no-bulk-fetch 边界。
- 对应测试和手动验收结果。

## 安全边界

项目必须保持：

- 不自动提交豆瓣条目。
- 不点击豆瓣“下一步”“取消”或“添加无条形码的唱片”。
- 不寻找、打开或绕过豆瓣新增条目入口。
- 不处理登录、不判断登录状态。
- 不读取 cookies。
- 不处理验证码。
- 不绕过审核、限流或社区规则。
- 不批量请求 Discogs API。
- 不后台爬取 Discogs 或豆瓣。
- 不自动上传、下载或替换封面。
- 不默认覆盖豆瓣表单已有值。
- 不收集、上传或同步用户数据。

## 表单填写规则

写入豆瓣前必须满足：

- 数据已进入 review UI。
- 用户已检查并确认可填写字段。
- 字段在 #8 第一版支持的 safe text input / textarea 白名单中。
- 目标字段为空。

不允许写入：

- custom selects：流派、专辑类型、介质。
- hidden/system fields：`ck`、`cat`、`no_uid`、`search_text`、`m_48`。
- barcode，除非未来确认稳定安全 selector 并通过 review。
- coverImageUrl、catalogNumber、unmapped 数据。

## Review Checklist

涉及下列内容的 PR 必须显式说明安全影响：

- Manifest permissions。
- Discogs API 请求行为。
- Draft storage。
- Review UI confirmation。
- Douban page detection。
- Douban field selector 或 form filling。
- Error handling that may change user-facing guidance。

最低验证：

```bash
npm test
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```
