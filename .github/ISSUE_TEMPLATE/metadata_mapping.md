---
name: Metadata mapping
about: 报告 Discogs 到豆瓣草稿字段映射问题
title: "[Mapping] "
labels: metadata
assignees: ""
---

## Discogs 来源

- Release URL:
- Release ID:

## 字段

- Source field:
- Douban draft field:

## 预期输出

请写明期望的草稿值。

## 实际输出

请写明当前生成的草稿值。

## 为什么当前结果有问题

例如：多 artist 合并错误、日期精度错误、CJK 字符丢失、tracklist 格式不适合豆瓣等。

## Fixture suitability

- [ ] 适合作为 regression fixture
- [ ] 涉及缺失 optional field
- [ ] 涉及 CJK / 特殊字符
- [ ] 涉及多 artist / 多 label / 多 format
- [ ] 涉及多碟 / nested tracklist

## 安全边界

该问题是否需要改变权限、自动化行为或豆瓣填写行为？

- [ ] 否
- [ ] 是，请说明：
