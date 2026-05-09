# douban-music-importer v0.1 MVP Spec

本文档是 `douban-music-importer` v0.1 的执行基线。后续实现、拆 issue、review、README 和路线图更新都应与本文档保持一致，除非有新的决策记录明确修改方向。

## 1. 项目目标

`douban-music-importer` 是一个浏览器扩展项目，用于帮助用户从外部音乐资料库导入音乐专辑或发行版本元数据，并辅助填写豆瓣音乐新条目表单。

v0.1 只聚焦一个主流程：用户从 Discogs release 页面启动插件，插件基于当前 release URL 调用 Discogs 官方 API 获取公开元数据，生成可审阅草稿，用户检查和编辑后，在已经打开的豆瓣音乐新条目表单上辅助填写，最后由用户自行提交。

项目定位是“辅助录入”，不是自动发布、自动搬运或批量创建工具。

## 2. v0.1 产品决策

v0.1 必须遵守以下产品和安全决策：

1. 豆瓣新条目页面入口由用户自行进入。插件不负责寻找、打开或绕过新增入口；v0.1 只在用户已经打开豆瓣音乐新条目表单后工作。
2. 豆瓣登录由用户自行完成。插件不负责登录、不读取 cookies、不处理验证码、不判断或绕过登录状态。如果用户未登录，豆瓣页面自行跳转登录，插件只提示用户先完成登录并打开新条目表单。
3. Discogs 页面只是入口。v0.1 从当前 Discogs release URL 解析 `release_id`，并请求 Discogs 官方 API 获取公开元数据。
4. Discogs API 只请求用户当前打开的 release，不批量请求、不后台爬取、不自动遍历 master/release 列表。
5. Discogs 数据只作为草稿来源。写入豆瓣前，所有字段必须经过 review UI，用户可见、可编辑、可删除、可确认。
6. 低置信度、无法映射、多值合并、格式转换或可能有歧义的字段默认标记为需要复核。
7. 豆瓣新条目流程包含查询/消重页和详细表单页。v0.1 应识别这两个状态，但只在用户已进入详细表单后辅助填写字段。
8. 无条形码添加是常见路径。Discogs barcode 可导入为草稿字段，但缺失 barcode 不应阻塞 v0.1 主流程。
9. v0.1 不自动上传封面图片。插件最多展示封面预览、展示来源封面 URL 或提供复制 URL 的能力；是否下载、上传或更换封面由用户自行决定。
10. 豆瓣表单已有内容默认不覆盖。若目标字段已有值，必须用户确认后才允许覆盖。
11. v0.1 不收集、不上传、不同步用户数据。草稿默认只保存在浏览器本地或 session storage 中。
12. 不自动提交豆瓣条目，不绕过审核、限流或社区规则。

## 3. v0.1 范围

v0.1 支持：

- 识别 Discogs release 页面。
- 从当前页面 URL 解析 `release_id`。
- 用户主动触发后，请求 `GET https://api.discogs.com/releases/{release_id}`。
- 处理 Discogs API 的成功、404、429、网络失败和字段缺失。
- 从 Discogs API 数据生成内部 release metadata。
- 从内部 metadata 生成豆瓣音乐草稿。
- 展示 review UI。
- 允许用户检查、编辑、删除、确认字段。
- 默认以本地/session storage 保存当前导入草稿。
- 检测用户已经打开的豆瓣音乐新条目表单。
- 识别豆瓣新条目的查询/消重页，并提示用户完成必要步骤。
- 支持用户选择无条形码添加后进入的详细表单。
- 在用户确认后辅助填写支持字段。
- 检测豆瓣表单已有值，并默认不覆盖。
- 展示 Discogs 来源 URL 和必要 attribution。

v0.1 不支持：

- RYM 导入。
- AOTY 导入。
- Discogs master 自动选择最佳 release。
- 从 Discogs 页面 HTML 抓取核心元数据作为主路径。
- 豆瓣重复条目自动检测。
- 自动打开豆瓣新条目入口。
- 自动登录豆瓣。
- 读取 cookies。
- 处理验证码。
- 自动上传封面。
- 自动提交豆瓣条目。
- 批量导入或批量创建。
- 后台爬取。
- 后端服务、账号系统或云同步。

## 4. 用户流程

1. 用户打开 Discogs release 页面，例如 `https://www.discogs.com/release/123456-Artist-Album`。
2. 插件识别当前页面是 Discogs release 页面。
3. 插件从 URL 解析 `release_id = 123456`。
4. 用户点击插件入口，例如“生成豆瓣草稿”。
5. 插件请求 `https://api.discogs.com/releases/123456`。
6. 插件将 API 数据标准化为内部 release metadata。
7. 插件映射出 `DoubanMusicDraft`。
8. 插件在 review UI 中展示所有将用于豆瓣的字段、来源、置信度和警告。
9. 用户检查、编辑、删除并确认字段。
10. 用户自行登录豆瓣，并自行打开豆瓣音乐新条目页面。
11. 如果当前页面是查询/消重页，插件只提示用户完成豆瓣要求的下一步；无条形码添加是常见路径。
12. 插件检测当前页面是否为可支持的新条目详细表单。
13. 如果未检测到详细表单，插件只提示用户先完成登录并打开正确页面。
14. 用户确认后，插件辅助填写支持字段。
15. 如果目标字段已有内容，插件默认不覆盖；用户确认后才可覆盖。
16. 插件不点击提交按钮。
17. 用户在豆瓣页面人工检查并自行提交。

## 5. 技术架构

v0.1 采用 Manifest V3 浏览器扩展。

推荐结构：

```text
douban-music-importer/
  manifest.json
  src/
    background/
      service-worker
    content/
      discogs-page-detector
      douban-form-assistant
    popup/
      popup-ui
    review/
      import-review-ui
    core/
      discogs-url-parser
      discogs-api-client
      normalizers/
      mappers/
      schema/
      validation/
    storage/
      draft-store
      settings-store
```

主数据流：

```text
Discogs Release Page
  -> parse release_id from current URL
  -> user action
  -> GET https://api.discogs.com/releases/{release_id}
  -> Discogs API JSON
  -> AlbumReleaseMetadata
  -> DoubanMusicDraft
  -> Draft Store
  -> Review UI
  -> user confirmation
  -> user opens Douban Music new-subject form
  -> Douban Form Assistant
  -> form fill after confirmation
  -> manual user submission
```

## 6. 模块边界

### Discogs Page Detector

职责：

- 只在 Discogs 页面上运行。
- 判断当前 URL 是否为 v0.1 支持的 release 页面。
- 从 URL 解析 `release_id`。
- 提供用户主动触发导入的入口。

非职责：

- 不抓取 Discogs HTML 作为主数据源。
- 不扫描页面内所有 release 链接。
- 不批量收集 release。
- 不直接操作豆瓣页面。

### Discogs API Client

职责：

- 根据单个 `release_id` 请求 Discogs 官方 API。
- 请求目标仅限当前用户打开页面对应的 release。
- 处理 404、429、网络失败、空响应和字段缺失。
- 暴露 rate-limit 相关错误信息供 UI 提示。

非职责：

- 不后台爬取。
- 不批量请求。
- 不自动遍历 master/release 列表。
- 不关心豆瓣字段。

### Release Normalizer

职责：

- 将 Discogs API JSON 转换为内部 `AlbumReleaseMetadata`。
- 保留来源 URL、API response 来源、字段 provenance 和 warnings。
- 对 artist、date、label、format、identifier、tracklist 做最小规范化。

非职责：

- 不做豆瓣表单 selector 判断。
- 不直接写入页面。
- 不为缺失字段做激进推断。

### Douban Draft Mapper

职责：

- 将 `AlbumReleaseMetadata` 转换为 `DoubanMusicDraft`。
- 输出建议填充值，而不是直接写入豆瓣。
- 标记低置信度、无法映射、多值合并和格式转换字段。
- 保留 unmapped 字段供用户查看。

非职责：

- 不操作 DOM。
- 不提交表单。

### Review UI

职责：

- 展示所有将进入豆瓣草稿的字段。
- 展示来源、置信度、warnings 和 `needsReview`。
- 允许用户编辑、删除、确认字段。
- 展示或复制封面 URL，但不上传封面。
- 展示 Discogs 来源 URL 和 attribution。

非职责：

- 不自动写入豆瓣。
- 不隐藏低置信度字段。

### Draft Store

职责：

- 保存当前导入流程的草稿。
- 默认使用浏览器本地/session storage。
- 不上传、不同步、不发送到第三方服务。

非职责：

- 不做云同步。
- 不长期保存导入历史，除非未来用户明确选择保存。

### Douban Form Assistant

职责：

- 只在用户已经打开的豆瓣音乐新条目表单上工作。
- 检测当前 DOM 是查询/消重页还是详细表单页。
- 在查询/消重页只提示用户继续豆瓣原生流程，不自动点击下一步或无条形码添加。
- 在用户确认后辅助填写支持字段。
- 写入前检查目标字段是否已有内容。
- 已有内容默认不覆盖；覆盖必须用户确认。
- 当前页面不是目标表单时，只提示用户打开正确页面。

非职责：

- 不寻找或打开豆瓣新条目入口。
- 不自动通过查询/消重页。
- 不负责登录。
- 不读取 cookies。
- 不判断登录状态。
- 不处理验证码。
- 不绕过审核、限流或社区规则。
- 不点击提交按钮。

## 7. 数据结构设计

内部模型以 release 为核心，因为 v0.1 主数据源是 Discogs release API。

```ts
type AlbumReleaseMetadata = {
  schemaVersion: "0.1";
  source: SourceInfo;
  release: {
    title: string;
    displayTitle?: string;
    artists: ArtistCredit[];
    releaseDate?: DatePrecision;
    country?: string;
    labels: LabelCredit[];
    companies?: CompanyCredit[];
    formats: FormatInfo[];
    genres: string[];
    styles: string[];
    identifiers: Identifier[];
    catalogNumbers: CatalogNumber[];
    tracklist: Track[];
    credits: Credit[];
    notes?: string;
    coverImage?: ImageRef;
    externalUrls: ExternalUrl[];
  };
  confidence: Record<string, "high" | "medium" | "low">;
  provenance: Record<string, string[]>;
  warnings: ImportWarning[];
};
```

```ts
type SourceInfo = {
  provider: "discogs";
  sourceType: "release";
  url: string;
  id: string;
  apiUrl: string;
  fetchedAt: string;
  extractorVersion: string;
};
```

```ts
type ArtistCredit = {
  name: string;
  role?: "main" | "featuring" | "composer" | "conductor" | "remixer" | "producer" | "other";
  joinPhrase?: string;
  sourceUrl?: string;
};
```

```ts
type DatePrecision = {
  value: string;
  precision: "year" | "month" | "day";
};
```

```ts
type LabelCredit = {
  name: string;
  catalogNumber?: string;
  sourceUrl?: string;
};
```

```ts
type CompanyCredit = {
  name: string;
  role?: string;
  sourceUrl?: string;
};
```

```ts
type FormatInfo = {
  type: "CD" | "Vinyl" | "Cassette" | "Digital" | "File" | "SACD" | "DVD" | "Other";
  quantity?: number;
  descriptions?: string[];
};
```

```ts
type Identifier = {
  type: "Barcode" | "Matrix" | "Rights Society" | "Other";
  value: string;
  description?: string;
};
```

```ts
type CatalogNumber = {
  label?: string;
  value: string;
};
```

```ts
type Track = {
  position?: string;
  title: string;
  duration?: string;
  artists?: ArtistCredit[];
  credits?: Credit[];
  subTracks?: Track[];
};
```

```ts
type Credit = {
  name: string;
  role: string;
  target?: "release" | "track";
  trackPosition?: string;
};
```

```ts
type ImageRef = {
  url: string;
  kind: "cover" | "back" | "media" | "other";
  source: "api" | "user";
};
```

```ts
type ExternalUrl = {
  provider: "discogs" | "official" | "other";
  url: string;
};
```

```ts
type ImportWarning = {
  field?: string;
  level: "info" | "warning" | "error";
  message: string;
};
```

豆瓣草稿模型独立于内部 release metadata。它表示“建议填写意图”，不是来源事实本身。

```ts
type DoubanMusicDraft = {
  schemaVersion: "0.1";
  sourceUrl: string;
  attribution: string;
  fields: {
    title?: DraftField<string>;
    originalTitle?: DraftField<string>;
    artists?: DraftField<string>;
    releaseDate?: DraftField<string>;
    publisher?: DraftField<string>;
    media?: DraftField<string>;
    genre?: DraftField<string>;
    barcode?: DraftField<string>;
    catalogNumber?: DraftField<string>;
    tracks?: DraftField<string>;
    summary?: DraftField<string>;
    externalLinks?: DraftField<string>;
    coverImageUrl?: DraftField<string>;
  };
  unmapped: UnmappedField[];
};
```

```ts
type DraftField<T> = {
  value: T;
  sourceFields: string[];
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  note?: string;
};
```

```ts
type UnmappedField = {
  sourceField: string;
  value: unknown;
  reason: string;
};
```

## 8. 字段优先级

高优先级：

- Release title。
- Release artists。
- Release date 或 year。
- Labels。
- Media formats。
- Tracklist。
- Barcode，如果 Discogs 提供；缺失时不阻塞主流程。
- Catalog numbers。
- Discogs source URL。

中优先级：

- Country / region。
- Genres / styles。
- Release notes。
- Cover image URL，仅展示或复制，不自动上传。

低优先级：

- Complete credits。
- Company credits。
- Matrix / runout identifiers。
- Detailed release-version differences。

低优先级字段默认进入 unmapped、notes 或 review-only 区域，不应阻塞 v0.1。

## 9. 权限策略

推荐 v0.1 权限：

```json
{
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": [
    "https://www.discogs.com/*",
    "https://discogs.com/*",
    "https://api.discogs.com/*",
    "https://music.douban.com/*"
  ]
}
```

说明：

- `https://www.discogs.com/*` / `https://discogs.com/*` 用于识别用户当前打开的 Discogs release 页面。
- `https://api.discogs.com/*` 用于请求当前 release_id 对应的官方 API 数据。
- `https://music.douban.com/*` 用于在用户已打开的豆瓣音乐新条目表单上辅助填写。
- `storage` 仅用于本地/session 草稿或未来明确的用户设置。

Manifest 不应申请：

- `cookies`
- `<all_urls>`
- `webRequest`
- `declarativeNetRequest`
- `tabs`，除非未来有明确需求
- broad background network access

候选 URL patterns：

```text
Discogs:
  https://www.discogs.com/release/*
  https://www.discogs.com/*/release/*

Discogs API:
  https://api.discogs.com/releases/*

Douban:
  https://music.douban.com/new_subject*
```

`https://music.douban.com/subject_create*` 当前未确认，不能作为 v0.1 已确认目标。

## 10. v0.1 里程碑

### v0.1.0

- 更新 README 和 MVP spec，使其与 API-first、安全边界一致。
- 创建 Manifest V3 扩展骨架。
- 实现 Discogs release URL detection。
- 实现 `release_id` parser。
- 实现 Discogs API client。
- 实现 API 错误和 rate-limit 提示。
- 定义 `AlbumReleaseMetadata` 和 `DoubanMusicDraft`。
- 实现 Discogs API response normalizer。
- 实现 Douban draft mapper。
- 实现 review UI。
- 实现本地/session draft store。
- 登录后人工确认豆瓣新条目表单字段。
- 记录豆瓣查询/消重页和无条形码详细表单路径。
- 实现 Douban form assistant。
- 实现 no-overwrite 行为。
- 建立 8-10 个 Discogs API fixture。
- 建立 v0.1 release gate。

### v0.2

- 增强 Discogs API 数据兼容性。
- 改进多碟、多格式、多厂牌、多 catalog number 处理。
- 改进错误提示和字段映射说明。

### v0.3

- 改进草稿体验。
- 探索 Discogs master 到 release 的辅助选择。

### v0.4

- 调研并原型支持 RYM。

### v0.5

- 调研并原型支持 AOTY。

### v1.0

- 稳定 Discogs release 到豆瓣新条目辅助填写主流程。
- 完善测试、隐私权限文档、贡献流程和发布流程。

## 11. QA 与验收标准

v0.1 必须满足：

- 只在 Discogs release 页面提供导入入口。
- 能从当前 URL 稳定解析 `release_id`。
- Discogs API 请求只针对当前页面对应的单个 release。
- 不批量请求 Discogs API。
- 不后台爬取。
- API 404、429、网络失败、字段缺失都有明确错误。
- 所有 Discogs 数据先进入 review UI。
- 用户确认前不写入豆瓣表单。
- 每个低置信度、无法映射、多值合并或格式转换字段标记 `needsReview`。
- 用户可以编辑、删除、确认所有 draft 字段。
- 封面不自动下载、不自动上传、不自动替换。
- 封面最多展示预览、展示来源 URL 或复制 URL。
- 豆瓣新条目页面由用户自行打开。
- 豆瓣查询/消重页由用户自行操作，插件不自动点击下一步或无条形码添加。
- 豆瓣登录由用户自行完成。
- 插件不读取 cookies。
- 插件不处理验证码。
- 插件不判断登录状态。
- 当前页面不是豆瓣新条目表单时，只提示用户打开正确页面。
- 豆瓣目标字段已有值时默认不覆盖。
- 覆盖已有值必须由用户确认。
- 插件不点击提交按钮。
- 草稿默认只保存在浏览器本地/session storage。
- 不收集、不上传、不同步用户数据。
- Manifest 不包含 `cookies`、`<all_urls>`、`webRequest`。
- 除非未来有明确需求，Manifest 不包含 `tabs`。

推荐 fixture 类型：

- 标准欧美 CD release。
- 黑胶 A/B 面 release。
- 多碟或 box set。
- Various Artists 合辑。
- 日本发行或 CJK 文本 release。
- 多 label / 多 catalog number release。
- 缺失 barcode、完整日期、封面或曲目的 release。
- 特殊字符、重音字符、括号、斜杠、remix title release。
- Discogs API 404 / 429 / 网络失败模拟。
- 豆瓣表单已有输入场景。

## 12. 文档与开源维护

README 应保持简洁，面向第一次打开 repo 的 GitHub 访问者。

MVP spec 应保留详细执行规划，包括：

- 产品边界。
- 安全边界。
- 技术架构。
- 模块边界。
- 数据结构。
- 权限策略。
- QA 和验收标准。

后续建议新增：

- `docs/research-discogs-api.md`
- `docs/research-douban-form.md`
- `docs/field-mapping.md`
- `docs/privacy-and-permissions.md`
- `docs/qa-plan-v0.1.md`
- `docs/fixtures.md`
- `CONTRIBUTING.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/metadata_mapping.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/ISSUE_TEMPLATE/site_compatibility.md`
- `.github/pull_request_template.md`

## 13. 风险与开放问题

开放问题：

- 豆瓣登录后的真实新条目表单 URL 是否稳定为 `https://music.douban.com/new_subject`。
- 豆瓣无条形码路径是否稳定进入同一详细表单。
- 豆瓣表单真实字段 name、id、label、required、校验规则是什么。
- 豆瓣封面是否支持 URL，还是只能用户手动上传。
- 豆瓣是否有适合写 Discogs source URL / attribution 的字段。
- Discogs API v0.1 是否需要用户配置 token，还是无 token 请求足够。
- Discogs API fixture 保存完整 JSON 还是裁剪后的稳定 snapshot。

已知风险：

- Discogs API 限流。
- Discogs API 字段结构变化。
- Discogs release 与豆瓣音乐条目语义不完全一致。
- 豆瓣表单 DOM 变化。
- 多艺人、多厂牌、多版本、多语言字段容易误映射。
- 用户可能过度信任导入结果。
- Discogs 图片 URL 涉及版权、缓存和防盗链问题。

## 14. 决策记录

v0.1 初始决策：

- v0.1 支持 Discogs release 页面优先。
- Discogs 页面只是入口，主数据源是 Discogs 官方 API。
- `release_id` 来自用户当前打开的 Discogs release URL。
- Discogs API 只请求当前 release，不批量请求、不后台爬取。
- 核心内部对象是 release，不是泛化 album。
- Discogs 数据只作为草稿来源。
- 所有字段写入豆瓣前必须经过 review UI。
- 低置信度或无法映射字段默认需要复核。
- 豆瓣入口由用户自行进入。
- 豆瓣登录由用户自行完成。
- 插件不负责登录、不读取 cookies、不处理验证码、不判断登录状态。
- 插件只在用户已打开的豆瓣音乐新条目表单上工作。
- 豆瓣表单已有内容默认不覆盖，覆盖必须用户确认。
- v0.1 不自动上传封面，只展示或复制封面 URL。
- 草稿默认只保存在浏览器本地/session storage。
- v0.1 不收集、不上传、不同步用户数据。
- 插件不自动提交豆瓣条目。
- 插件不绕过审核、限流或社区规则。
- Manifest 不申请 `cookies`、`<all_urls>`、`webRequest`。
- 除非未来有明确需求，否则 Manifest 不申请 `tabs`。
- RYM 和 AOTY 是未来来源，不属于 v0.1。
