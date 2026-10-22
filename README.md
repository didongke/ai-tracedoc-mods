# ai-tracedoc

把每个项目里的 Claude Code 问答记进一份 TraceDoc 账簿。

它以 Claude Code 的**钩子模块**(hooks module)运行 —— **没有二进制**,也就没有东西会让 Windows Smart App Control 拦下。每个问答写两份:人看的 Markdown 账簿、机器读的 JSONL。源码里没有一处平台分支,Windows、Linux、macOS 都实际跑过、写出过账簿(macOS 最后补上,2026-10-22)。

## 价值

**对话断了,工作不断。** 上下文有上限,到顶时 API 回的就是 `400 … maximum context length`(2026-10-22 撞过一次)。重开一个会话,让它先读这个项目的 `*-tracedoc.md`:问过什么、当时结论是什么、下一步该做什么,它自己接上 —— 不用你回忆,也不用重新讲一遍。账簿里是问题和回答,**结论和理由都在**;代码现在什么样,它自己去看。

**把开发过程变成数据。** 一条问答一行 JSONL,都带时间。攒够了就能看出哪里反复卡住、哪些问题其实是同一个根因、哪类提问效率最低。这一层要时间,越用越有东西可看。

前者雪中送炭,后者锦上添花。

## 安装

**需要 Claude Code ≥ 2.1.287**(Desktop app 是 2.1.286)。更低的版本引擎不加载钩子模块,装了也不记录。查版本:`claude --version`。

```
/plugin marketplace add https://github.com/didongke/ai-tracedoc-mods
/plugin install ai-tracedoc-mods@ai-tracedoc-mods
```

**用完整 HTTPS 地址,别用 `didongke/ai-tracedoc-mods` 简写**:简写会被解析成 SSH 地址,没连过 GitHub 的机器上没有 `github.com` 的 host key,而非交互的克隆没法问你信不信,于是直接 `Host key verification failed`(2026-10-19 一台新 macOS 上就是这么失败的)。公开仓库走 HTTPS 不需要任何密钥。开发时改用本地目录:`claude plugin marketplace add "<插件目录>"`,再跑同样的 install。

装完打开 `/plugin`,标签页下面那行灰字应写着 `1 mod active · ai-tracedoc-mods`。没有这行就是模块没加载,`/version` 走的是 `commands/version.md` 那条兜底路。

> **别和 exe 版的 ai-tracedoc 同时开在一个项目里**([`didongke/ai-tracedoc`](https://github.com/didongke/ai-tracedoc),也是低于 2.1.287 的机器唯一能用的那版)。它写同一个账簿文件名,而这份没有 append、只能整份读-改-写 —— 两个一起写会互相抹掉。

### 更新

```
/plugin marketplace update ai-tracedoc-mods
/reload-plugins
```

`/plugin` 面板里效果一样(Marketplaces → **Update marketplace**,Installed → **Update now**),关面板时会替你跑一次 `/reload-plugins`。**没有 `/plugin update <名字>` 这个命令** —— `update`、`init`、`details` 这些都没有会话形态,面板里那个是动作。第三方 marketplace 默认不自动更新,要跟就在面板里开 **Enable auto-update**。生效没有,看 `/version`。

直接改这个仓库那份时没有"更新"这一步:引擎读的就是工作树,改完 `/reload-plugins` 即可,版本号都不用动。reload 会重跑 `register` 和 `session.start` —— 待答的提问和会话状态都镜像在 `$.store` 里,所以落在提问和回答之间不丢那一轮,也不会多写一个 `## 标题`。

## 使用

| 命令 | 作用 |
| --- | --- |
| `/ai-tracedoc-mods:on` | 开始记录(创建 `.tracedoc-on`) |
| `/ai-tracedoc-mods:off` | 停止记录(删除 `.tracedoc-on`) |
| `/ai-tracedoc-mods:version` | 显示版本 |

`version` 由**模块自己回答**,引擎直接打印、不经过模型;数字和状态文件、`plugin.json` 一致(`test/run.mjs` 守着这条):

```
ai-tracedoc-mods: 0.5.4-mods.1
```

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

所以问题或回答再长,也不会跟标签挤在同一行。

### 一行(JSONL)

```json
{"time":"2026-10-15T09:26:07+08:00","question":"…","answer":"…"}
```

- `time` 是**提问那一刻**,ISO 8601 带本机时区;和账簿里那行同一瞬,账簿只记到分钟
- **只写答完的问答** —— 没等到答案的、没记上的,只在账簿里
- 中文原样写,不转 `\uXXXX`;换行和引号按 JSON 转义,一条再长也始终是一行
- 没有表头行,`jq` 不用跳第一行。历史从装上之后的第一条开始,和"没有补记"是同一条原则
- 别用 `cat *-tracedoc.jsonl` 拼:字节序里 `-02.jsonl` 排在基础卷前面,要按时间读就把文件显式列出

挑出提到 SAC 的问题:

```
jq -r 'select(.question | test("SAC")) | [.time, (.question | split("\n")[0])] | @tsv' *-tracedoc.jsonl
```

没装 `jq` 也行,node 等价:

```
node -e 'const fs=require("fs");for(const f of process.argv.slice(1))fs.readFileSync(f,"utf8").split("\n").filter(Boolean).map(JSON.parse).filter(o=>/SAC/.test(o.question)).forEach(o=>console.log(o.time+"\t"+o.question.split("\n")[0]))' *-tracedoc.jsonl
```

## 记什么、不记什么

**只记人写的问题和模型的回答。** 两条判据,少一条就漏:

- **谁写的** —— `origin.kind` ∈ {`human`, `composer`}(transcript 报 `human`,实时行报 `composer`)。光看 door 不够:引擎也往 `prompt` 门里塞自己的消息,只看 door 会把后台任务完成通知(`<task-notification>`)当成提问。
- **它是什么** —— 命令的记录行不报 engine:**插件命令**(`/on`、`/off`)报的是人的 origin,靠 origin 认就会收下(0.5.3 漏在这里)。所以命令靠**开头**认:以 `<command-message>`、`<command-name>`、`<local-command-caveat>`、`<local-command-stdout>` 开头的一律不收。"以……开头"是判据的全部 —— 提问里**引用**一条账簿记录也带着这些标记,那是提问,照收。

回答那一格是每轮的**最终答复**,不是 transcript —— 不含工具输出和思考;没答完的那轮留一个空 `**Answer:**`。子代理的行不算。引擎通知、system-reminder、工具结果、别的会话的消息,一律不进账簿。这些都是从本机逐行核出来的行形状,不是猜的。

一轮只留一条提问(`pending` 只有一个槽,后到的顶掉先到的)。整轮只有命令的,不进账簿,记在 `commandTurnsSkipped` 里,和"提问丢了"(`orphanAnswers`)分开数。

## 限制

1. **没有补记。** 拿不到就永远拿不到 —— 但会写进账簿:下一次成功记录时多一行 `> ⚠ TraceDoc: a turn went unrecorded — …`。丢东西不瞒着,但确实丢了。这是换"不被 SAC 拦"的代价。
2. **同一项目两个会话会互相覆盖。** 只有单会话内一条串行链,没有跨进程锁。
3. **会话标题退化成首问**(压平一行、截 40 字)。
4. **提问时间是钩子运行时刻**,不是提问时刻;差毫秒级。
5. **换个加载身份会多一个 `## 标题`** —— 会话状态在引擎 store 里、按身份分开(`--plugin-dir` 和装进插件目录不通用);条目一条不丢。

## 诊断

插件目录下的 `.tracedoc-mods-status.json` 每轮重写。"怎么没记上"就看它:

- `updatedAt` / `session` / `volume` —— 谁、哪一卷写的;配 `version` 就知道"刚改完跑的是不是新的那份"
- `recorded` / `turns` / `skippedDisabled` —— 记了几轮 / 发生几轮 / 没开记录跳过几轮
- `jsonlRows` / `jsonlFailures` —— `recorded` 比 `jsonlRows` 大是正常的;`jsonlFailures > 0` 就是那一轮只进了账簿,`jsonlErrors` 有原文。这种失败**不会**在账簿里留 ⚠ 行,那行的意思必须是"这一轮没记上"
- `commandTurnsSkipped` —— 命令轮,涨是正常的
- `orphanAnswers` —— **大于 0 就是真丢了东西**
- `rowsNotRecorded` / `appendShapes` / `doorSamples` —— 被拒的行数、每行的形状计数、每个 door 的一条样本。哪天 `prompt | … | origin=<新叫法>` 在涨而 `turns` 不涨,就是引擎换了叫法,判据得跟着改
- `hookFailures` / `unreportedFailures` —— 钩子自己出错的原文

## 测试

```
node test/run.mjs hooks/tracedoc.js
```

用假的 `$` 驱动记录器,断言账簿的字节(卷头、标题、排版、200 KiB 滚卷、未答的收尾、写盘失败的缺口行、哪些行算提问)、JSONL 的每一行、状态文件报的版本与计数。需要 Node,无依赖。

## 文件

```
.claude-plugin/plugin.json        插件清单
.claude-plugin/marketplace.json   marketplace 清单
hooks/hooks.json                  声明 modules: ["./tracedoc.js"]
hooks/tracedoc.js                 记录器本体,也是 /version 的应答方
commands/{on,off}.md              开、关
commands/version.md               声明 /version;正文是模块没加载时的兜底
tsconfig.json                     编辑器类型检查入口
test/run.mjs                      格式护栏
```

加载器运行前会静态读模块源码:把 `on`、`$`、`$.env` 不按字面拼写的模块不会被加载 —— 所以没有别名、没有解构、没有拼出来的事件名。代码里凡是故意这么写的地方都标了出处,明知有代价的地方都写了代价,提问判据和卷号解析就是两处。
