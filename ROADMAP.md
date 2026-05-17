# Roadmap

## v0.1

状态：主链路已实现，发布前验证阶段。

目标：

- 从 Discogs release 页面解析 `release_id`。
- 请求单个 Discogs 官方 API release endpoint。
- 标准化 release metadata。
- 生成可审阅 Douban draft。
- 通过 review UI 让用户编辑、删除、确认字段。
- 在用户已经打开的豆瓣音乐新条目详细表单上安全辅助填写。
- 保持 no-submit、no-cookie、no-login、no-bulk-fetch、no-overwrite 安全边界。

## v0.2

方向：

- RYM current-page album extractor to Douban draft prototype。
- 支持用户手动打开 RYM album 页面后点击插件，读取当前页 DOM / 可见文本，并在本地解析为 `DoubanMusicDraft`。
- manual paste / local parsing 作为 current-page DOM 不稳定、字段不足或页面暂不支持时的 fallback。
- 用于新专辑、非实体发行、Discogs release 尚不完整的场景。
- 不自动请求 RYM 页面、不做 network importer、不自动抓取、不后台爬取、不绕过登录/验证码/访问限制。
- 不新增 RYM host permission；允许未来实现时新增最小 `scripting` permission，用于 `activeTab` 下的一次性注入。

## v0.3

方向：

- 增强 Discogs API 数据兼容性。
- 改进多碟、多格式、多厂牌、多 catalog number 处理。
- 改进错误提示和字段映射说明。

## v0.4

方向：

- 改进草稿 review 体验。
- 探索 Discogs master 到 release 的辅助选择，但不自动选择或批量遍历。

## v0.5

方向：

- 继续跟踪 RYM / Sonemic 是否提供官方 API、数据集或明确授权路径。
- 若没有官方路径，RYM 仍不做 network importer；只允许 current-page extraction 或 manual paste 这类用户发起、本地解析方案。

## v0.6

方向：

- 调研并原型支持 AOTY。
- 明确访问限制、服务边界和合规风险。

## v1.0

方向：

- 稳定 Discogs release 到豆瓣新条目辅助填写主流程。
- 完善测试、隐私权限文档、贡献流程和发布流程。
