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

状态：RYM current-page prototype 已实现，并完成三页真实页面手动 QA。

方向：

- RYM current-page album extractor to Douban draft prototype。
- 支持用户手动打开 RYM album 页面后点击插件，读取当前页 DOM / 可见文本，并在本地解析为 `DoubanMusicDraft`。
- RYM prototype 作为 album-level source，不作为 release/version source。
- v0.2 第一版主要使用 RYM 提供 title、artist、releaseDate、genres/descriptors（review-only）、tracklist 和 source URL。
- v0.2 第一版不从 RYM 自动生成 publisher/出版者；如果豆瓣要求出版者，用户需要手动填写，或后续从其它来源补充。
- v0.2 第一版不从 RYM 自动生成 `coverImageUrl`，不抓取、不上传、不复用 RYM cover URL；如果需要封面，用户手动处理。
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

状态：AOTY research、manual paste fallback 和 current-page prototype 已实现。

方向：

- 调研并原型支持 AOTY。
- 明确访问限制、服务边界和合规风险。

## v0.7

状态：Bandcamp research 和 current-page prototype 已实现，并完成真实页面
Chrome 手动 QA。

方向：

- 调研 Bandcamp 作为未来来源的可行性。
- 重点评估 album / release 页面可见字段、购买/流媒体页面的数据边界、artist label 关系、tracklist、source URL 和 attribution。
- 明确是否只能作为用户当前页面的本地解析来源，避免 network importer、后台抓取、批量请求、登录/cookie 读取、下载或复用音频/封面资源。

## v1.0

方向：

- 稳定 Discogs release 到豆瓣新条目辅助填写主流程。
- 完善测试、隐私权限文档、贡献流程和发布流程。
