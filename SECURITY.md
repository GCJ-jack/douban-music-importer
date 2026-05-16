# Security Policy

`douban-music-importer` 是本地浏览器扩展项目，不包含后端服务、账号系统或云同步。

## 支持范围

请报告以下安全问题：

- 意外读取或请求 cookies、账号状态、登录信息。
- 自动提交豆瓣条目或触发表单提交。
- 自动点击“下一步”“取消”“添加无条形码的唱片”等流程按钮。
- 修改 hidden/system fields，例如 `ck`、`cat`、`no_uid`、`search_text`、`m_48`。
- 批量请求、后台爬取或绕过来源网站限制。
- 未经 review UI 直接写入豆瓣表单。
- 默认覆盖用户已有输入。
- 不必要或过宽的 Manifest 权限。

## 不属于安全漏洞的内容

- Discogs 或豆瓣页面 DOM 变化导致 selector 失效。
- 用户手动提交了未检查的条目。
- Discogs API 返回数据本身不准确。

这些问题仍然可以作为 bug、metadata mapping 或 site compatibility issue 提交。

## 安全边界

项目不会：

- 读取 cookies。
- 处理登录。
- 处理验证码。
- 自动提交。
- 自动上传封面。
- 上传或同步用户数据。
- 批量抓取 Discogs 或豆瓣。

更多说明见 [docs/privacy-and-permissions.md](docs/privacy-and-permissions.md)。
