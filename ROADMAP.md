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

- 增强 Discogs API 数据兼容性。
- 改进多碟、多格式、多厂牌、多 catalog number 处理。
- 改进错误提示和字段映射说明。

## v0.3

方向：

- 改进草稿 review 体验。
- 探索 Discogs master 到 release 的辅助选择，但不自动选择或批量遍历。

## v0.4

方向：

- 调研并原型支持 RYM。
- 明确访问限制、服务边界和合规风险。

## v0.5

方向：

- 调研并原型支持 AOTY。
- 明确访问限制、服务边界和合规风险。

## v1.0

方向：

- 稳定 Discogs release 到豆瓣新条目辅助填写主流程。
- 完善测试、隐私权限文档、贡献流程和发布流程。
