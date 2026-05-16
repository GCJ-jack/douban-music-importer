# v0.1 Release Checklist

v0.1 仍处于发布前验证阶段。发布前必须完成自动测试和手动验收。

## 自动检查

```bash
npm test
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

预期：

- 所有 tests 通过。
- `manifest.json` 可解析。
- Manifest 不包含 `cookies`、`<all_urls>`、`webRequest`、`declarativeNetRequest`。
- Manifest 不包含 `tabs`，除非未来有明确 issue 和 review。

## Chrome 本地加载

1. 打开 `chrome://extensions/`。
2. 开启 Developer mode。
3. 点击 Load unpacked。
4. 选择仓库根目录。
5. 确认 `Douban Music Importer` 成功加载。

## Discogs 导入验收

1. 打开一个 Discogs release 页面。
2. 点击扩展 popup。
3. 确认页面支持状态和 `release_id` 正确。
4. 点击“获取 Discogs 元数据”。

预期：

- 只请求当前 release 对应的 Discogs API。
- 不批量请求。
- 不后台爬取。
- 显示 review draft。

## Review UI 验收

确认：

- 字段、来源、confidence、needsReview、warnings、unmapped 数据可见。
- 字段可编辑、删除、确认。
- 未确认可填写字段时，不应直接填写豆瓣表单。
- coverImageUrl 只能复制或查看，不自动上传。

## 豆瓣 lookup / 消重页验收

1. 用户自行打开 `https://music.douban.com/new_subject`。
2. 如果页面处于查询/消重页，点击 popup 填写入口。

预期：

- 插件只提示用户继续豆瓣原生流程。
- 不点击“下一步”。
- 不点击“添加无条形码的唱片”。
- 不点击“取消”。
- 不填写任何字段。

## 豆瓣详细表单验收

用户手动进入详细表单后，点击 popup 填写入口。

预期只填写空的 safe text input / textarea：

- 唱片名
- 表演者
- 发行时间
- 出版者
- 碟片数
- ISRC
- 曲目
- 简介
- 参考资料

预期不填写：

- barcode
- 流派
- 专辑类型
- 介质
- coverImageUrl
- catalogNumber
- unmapped 数据

## No-overwrite 验收

1. 在豆瓣详细表单中手动输入已有值。
2. 再触发填写。

预期：

- 已有值保持不变。
- popup 结果包含 `skippedExistingValue`。
- 不出现自动覆盖。

## Hidden/System Fields 验收

填写前后检查：

- `ck`
- `cat`
- `no_uid`
- `search_text`
- `m_48`
- custom select backing fields such as `p_116`、`p_57`、`p_49`

预期全部保持不变。

## 禁止行为

验收过程中不能发生：

- 自动提交。
- 自动打开豆瓣页面。
- 自动登录。
- 读取 cookies。
- 处理验证码。
- 点击“下一步”“取消”“添加无条形码的唱片”。
- 修改 hidden/system fields。
- 自动上传封面。
- 覆盖已有字段。
