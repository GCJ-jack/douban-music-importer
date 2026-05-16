## Summary

请简要说明本 PR 做了什么。

## Type

- [ ] 文档
- [ ] 测试 / fixture
- [ ] Discogs detection / API
- [ ] Normalizer / mapper
- [ ] Review UI / draft storage
- [ ] Douban form assistant
- [ ] 权限 / Manifest

## Safety Review

必须确认：

- [ ] 不自动提交豆瓣条目
- [ ] 不点击“下一步”“取消”或“添加无条形码的唱片”
- [ ] 不读取 cookies
- [ ] 不处理登录或验证码
- [ ] 不批量请求 Discogs API
- [ ] 不后台爬取
- [ ] 不自动上传封面
- [ ] 不默认覆盖豆瓣已有字段
- [ ] 不修改 hidden/system fields

如有任何项不适用或发生变化，请说明理由。

## Permission Changes

- [ ] 无权限变化
- [ ] 有权限变化

如有权限变化，请说明：

- 新增或修改的权限：
- 为什么现有权限不够：
- 是否涉及 `cookies`、`tabs`、`webRequest`、`<all_urls>`：
- 对应测试 / 手动验收：

## Source / Mapping / Filling Notes

如涉及以下内容，请说明：

- Discogs API 请求范围是否仍为当前 release only：
- 是否新增或修改 metadata mapping：
- 是否新增 fixture：
- 是否修改豆瓣 selector：
- 是否改变 no-overwrite 行为：

## Tests

- [ ] `npm test`
- [ ] manifest JSON parse check
- [ ] 手动 Chrome unpacked 验收
- [ ] 不适用，请说明：

## Checklist

- [ ] README/docs 已按需更新
- [ ] 新行为有测试或手动验收说明
- [ ] 安全边界与 `docs/privacy-and-permissions.md` 一致
