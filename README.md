# ai-tracedoc

把每个项目里的 Claude Code 问答记进一份 TraceDoc 账簿。

它以 Claude Code 的钩子模块(hooks module)运行。
每个问答写两份:人看的 Markdown 账簿、机器读的 JSONL。
源码里没有一处平台分支,Windows、Linux、macOS 都实际跑过、写出过账簿。

## 价值

1、**断点续工。**  
工作没干完就得停 —— 上下文到顶、换台机器、交给别人,前者是意外,后两者是计划内 —— 接着干时不用重新讲一遍。

- **上下文超限。** API 回 `400 … maximum context length`。重开会话,让它先读这个项目的 `*-tracedoc*.jsonl`:问过什么、当时结论是什么、下一步做什么,它自己接上。
- **换工作环境。** 办公室的台式机做到一半,提交,回家在笔记本上 `git pull`,记录跟着代码一起到位,接着做。
- **移交工作。** 别人打开这个项目,读记录、看 `git diff`:做到哪了、改了什么、下一步做什么、哪里要小心 —— 不用交接文档,不用开会。

2、**把开发过程变成数据资产。**  
一条问答一行 JSONL,都带时间。能分析哪里反复卡住、哪些问题其实是同一个根因、哪类提问效率最低,这是你开发的过程,可以从中提取出很多有用的信息。

前者雪中送炭,后者锦上添花。

## 记什么、不记什么

只记人写的问题和模型的回答。

回答那一格是每轮的**最终答复**,不是 transcript —— 不含工具输出和思考,引擎通知、system-reminder、工具结果、别的会话的消息,一律不进账簿。

## 安装

需要 Claude Code ≥ 2.1.287。
更低的版本引擎不加载钩子模块,装了也不记录。
查版本:`claude --version`。

```
/plugin marketplace add https://github.com/didongke/ai-tracedoc-mods
/plugin install ai-tracedoc-mods@ai-tracedoc-mods
```

建议用完整 HTTPS 地址,其次用 `didongke/ai-tracedoc-mods` 简写。
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

然后正常提问。问答写进项目根目录的**两份**文件:

```
<YYYYMMDD>-<项目名>-tracedoc.md     人翻阅的账簿
<YYYYMMDD>-<项目名>-tracedoc.jsonl  机器读的每一行
```

超过 200 KiB 时新会话开新卷 `-02.md`,JSONL 同名跟上,旧卷末尾留 `Continued in:` 链接。

### 账簿里的一条

标签独占一行,正文从下一行开始:

```
**Question:** 2026-10-15 09:26
这个问题是什么

**Answer:**
回答和结论
```

### JSONL里的一行

```json
{"time":"2026-10-15T09:26:07+08:00","question":"…","answer":"…"}
```

- `time` 是**提问那一刻**,ISO 8601 带本机时区;和账簿里那行同一瞬,账簿只记到分钟
- **只写答完的问答** —— 没等到答案的、没记上的,只在账簿里
- 中文原样写,不转 `\uXXXX`;换行和引号按 JSON 转义,一条再长也始终是一行
- 没有表头行,`jq` 不用跳第一行。历史从装上之后的第一条开始,和"没有补记"是同一条原则
