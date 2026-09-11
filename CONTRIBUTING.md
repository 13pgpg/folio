# Contributing to Folio

感谢你参与 Folio。

## 认领 Issue

如果你准备处理一个开放 Issue，可以直接评论：

```text
/claim
```

默认认领 14 天。也可以指定时间：

```text
/claim 7d
/claim 2w
```

最长 30 天。

Bot 会记录认领时间、添加 `claimed` 状态，并尽量把你加入 Assignee。GitHub 对部分外部贡献者可能暂时不允许自动写入 Assignee；这种情况下，Bot 的认领记录仍然有效。

如果需要续期，再次评论 `/claim` 即可。如果不再处理：

```text
/release
```

认领到期前，Bot 会自动提醒；到期仍未续期时会自动释放，避免 Issue 长期被占用。

## 提交 Pull Request

PR 如果解决某个 Issue，请在描述中加入：

```text
Closes #123
```

非 Draft PR 创建或重新进入 Ready for review 后，Community Bot 会：

- 添加 `needs-review`；
- 自动请求维护者 Review；
- 通过 GitHub notification 提醒相关人员；
- Review 要求修改时切换为 `waiting-on-author`；
- 作者 push 新提交后重新进入 Review 队列；
- Review 通过后标记 `approved`。

Bot 只负责社区状态流转和提醒，不会自动合并 PR。

## 每日社区巡检

仓库每天执行一次 Community Daily Triage：

- 检查即将到期或已经到期的认领；
- 自动释放过期认领；
- PR 超过 48 小时没有维护者 Review 时提醒维护者；
- `waiting-on-author` 超过 7 天没有更新时提醒作者；
- 在 GitHub Actions Job Summary 中生成当天的社区巡检摘要。

这些提醒通过 GitHub 的 mention、assignee 和 review request 机制发送。是否同时收到邮件由每个 GitHub 账号自己的 Notifications 设置决定，因此项目不需要收集贡献者邮箱。

## 自动化安全边界

社区工作流不会 checkout 或执行来自外部 PR 的代码。`pull_request_target` 仅用于更新标签、评论和 Review 请求，避免把具有写权限的 token 暴露给不可信代码。

如后续需要固定向维护者发送飞书、Slack、Discord 或自定义邮件摘要，应通过独立 webhook / mail provider secret 接入，不应把凭证写进仓库。
