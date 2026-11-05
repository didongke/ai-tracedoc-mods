# ai-tracedoc

把每个项目里的 Claude Code 问答记进一份 TraceDoc 账簿。

它以 Claude Code 的钩子模块(hooks module)运行。<br>
每个问答写两份：人看的 Markdown 账簿，机器读的 JSONL。<br>
三个平台（Windows、Linux、macOS）使用相同源码，都实际运行和测试过。

> 撞上 `400 … maximum context length` → 退出 → 重开会话 → "读这个项目的 `*-tracedoc*.jsonl`,接着干"<br>
> → 新会话自己说清做到哪、下一步做什么。

## 价值

1、**断点续工**  
工作没干完就得停（例如：上下文超限、换台机器工作、工作交接给别人）, 接着干时不用重新讲一遍。

- **上下文超限：** 大模型API上下文超限。重开会话,让它先读这个项目的 `*-tracedoc*.jsonl`,它可以自己接上继续工作。
- **换工作环境：** 办公室的台式机做到一半,提交,回家在笔记本上 `git pull`,记录跟着代码一起到位,接着做。
- **移交工作：** 别人打开这个项目,人工读记录，或者提供给AI，都可以继续工作。—— 不用交接文档,不用开会。

2、**把开发过程变成数据资产**  
一条问答一行 JSONL,都带时间，是完整的AI开发记录，可以从中分析出很多有用的信息。<br>
例如：哪里反复卡住、哪些问题其实是同一个根因、哪类提问效率最低。

## 记什么、不记什么

只记人写的问题和模型的最终答复。

不记录模型的处理过程 —— 不含工具输出和思考, 引擎通知、system-reminder、工具结果、别的会话的消息。

## 安装

需要 Claude Code ≥ 2.1.287。
更低的版本引擎不加载钩子模块,装了也不记录。
查版本: claude --version

```
/plugin marketplace add https://github.com/didongke/ai-tracedoc-mods
/plugin install ai-tracedoc-mods@ai-tracedoc-mods
```

建议用完整 HTTPS 地址,其次用 `didongke/ai-tracedoc-mods` 简写。<br>
装完打开 `/plugin`,标签页下面那行灰字应写着 `1 mod active · ai-tracedoc-mods`。

### 更新

```
/plugin marketplace update ai-tracedoc-mods
/reload-plugins
```

## 使用

| 命令 | 作用 |
| --- | --- |
| `/ai-tracedoc-mods:on` | 开始记录(创建 `.tracedoc-on`) |
| `/ai-tracedoc-mods:off` | 停止记录(删除 `.tracedoc-on`) |
| `/ai-tracedoc-mods:version` | 显示版本 |

没开记录的项目,**每次启动 Claude Code 时**右上角会提示一次 `/ai-tracedoc-mods:on`(`claude -c` 恢复会话也算),3 秒后自己消失。`/reload-plugins` 也会再提示一次 —— 钩子分不出这次是启动还是 reload,宁可多提示一次。

问答写进项目根目录的**两份**文件:

```
<YYYYMMDD>-<项目名>-tracedoc.md     人翻阅的账簿
<YYYYMMDD>-<项目名>-tracedoc.jsonl  机器读的每一行
```

超过 200 KiB 时新会话开新卷 `-02.md`,JSONL 同名跟上,旧卷末尾留 `Continued in:` 链接。

> **注意：别在同一个项目里同时开两个 Claude Code 会话。** 账簿是整份读-改-写的,没有跨进程锁 —— 两个会话同时写会互相覆盖,记录会丢。

### 账簿里的一条

标签独占一行,正文从下一行开始:

```
**Question:** 2026-10-15 09:26:07
这个问题是什么

**Answer:**
回答和结论
```

### JSONL里的一行

```json
{"time":"2026-10-15T09:26:07+08:00","question":"…","answer":"…"}
```

- `time` 是提问那一刻。
- 中文原样写,不转 `\uXXXX`; 换行和引号按 JSON 转义,一条再长也始终是一行。
- 没有表头行，历史从装上之后的第一条开始。

## 卸载

卸载插件后,项目目录里的 `.tracedoc-on`、`*-tracedoc*.md`、`*-tracedoc*.jsonl` 不会被自动删除,不需要就手动删掉;`.tracedoc-mods-status.json` 在插件目录里,随插件一起消失。
