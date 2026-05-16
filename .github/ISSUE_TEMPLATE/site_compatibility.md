---
name: Site compatibility
about: 报告 Discogs 或豆瓣页面结构兼容问题
title: "[Compat] "
labels: compatibility
assignees: ""
---

## 站点

- [ ] Discogs
- [ ] 豆瓣音乐

## 页面 URL

请提供触发问题的页面 URL。

## 页面状态

豆瓣页面请选择：

- [ ] 查询/消重页
- [ ] 详细表单页
- [ ] 其他

## 问题描述

页面识别、字段选择器或填写行为哪里不符合预期？

## 预期行为

应该如何检测或提示？

## 实际行为

当前发生了什么？

## 安全边界确认

是否出现以下情况？

- [ ] 自动提交
- [ ] 自动点击“下一步”“取消”或“添加无条形码的唱片”
- [ ] 修改 hidden/system fields
- [ ] 覆盖已有值

## Fixture / Test

- [ ] 可以补充为 regression test
- [ ] 需要更新 `docs/research-douban-form.md`
- [ ] 需要更新 release checklist
