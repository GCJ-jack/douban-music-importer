# Contributing

感谢关注 `douban-music-importer`。项目目前处于 v0.1 发布前验证阶段，最重要的是保持安全边界、字段映射准确性和回归测试稳定性。

## 基本原则

- 本项目是辅助录入工具，不是自动发布工具。
- 所有 Discogs 数据写入豆瓣前必须经过 review UI。
- 用户负责最终检查和提交。
- 不接受绕过登录、验证码、审核、限流或社区规则的实现。

## 开发前检查

```bash
npm test
```

提交前至少运行：

```bash
npm test
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

## 权限和安全

涉及以下内容的改动必须在 PR 中说明安全影响：

- Manifest permissions。
- Discogs API 请求范围。
- Draft storage。
- Review UI confirmation。
- Douban selector 或 form filling。
- Existing value overwrite behavior。

禁止默认引入：

- `cookies`
- `<all_urls>`
- `webRequest`
- `declarativeNetRequest`
- `tabs`

权限和安全边界见 [docs/privacy-and-permissions.md](docs/privacy-and-permissions.md)。

## Metadata Mapping Issues

字段映射问题请尽量提供：

- Discogs release URL。
- 期望的豆瓣草稿字段。
- 实际输出。
- 是否适合作为 fixture。
- 是否涉及多 artist、多 label、多格式、CJK、特殊字符或缺失字段。

真实 bug 应优先转成 `tests/fixtures/` 中的最小回归 fixture。

## Form Filling Changes

豆瓣表单填写改动必须保持：

- 不自动提交。
- 不点击“下一步”“取消”“添加无条形码的唱片”。
- 不读取 cookies。
- 不处理登录或验证码。
- 不修改 hidden/system fields。
- 默认不覆盖已有值。
- 不填 custom selects，除非未来有明确 selector、测试和 review。

## 文档和模板

文档以中文为主。必要的文件名、字段名、命令和 GitHub 模板项可以使用英文。
