# ai-tracedoc

把每个项目里的 Claude Code 问答记进一份 TraceDoc 账簿。

它以 Claude Code 的**钩子模块**(hooks module)运行,所以**没有二进制** —— 也就没有东西会让 Windows Smart App Control 拦下。每个问答同时写两份:人看的 Markdown 账簿,机器读的 JSONL。

**Windows、Linux、macOS 三个平台跑的是同一份代码。** 源码里没有一处平台分支,`basename`/`join` 自己认两种分隔符,也没有要编译、要签名、要按平台分发的东西。**三个平台都实际跑过、写出过账簿** —— macOS 是最后补上的,2026-10-22。

## 价值

**第一层:对话断了,工作不断。** 上下文有上限,对话总会断 —— 到顶时 API 回的就是 `400 … maximum context length is 1048576 tokens`,2026-10-22 本机撞上一次。退出,重开一个会话,让它先读这个项目里的 `*-tracedoc.md`:前面问过什么,当时得出的结论是什么,下一步该接着做什么,它自己就能接上,不用你回忆,也不用你重新组织语言讲一遍。账簿里存的是问题和回答本身 —— **结论和理由都在里面**;代码现在是什么状态,它自己去看。这是开发中每天都会遇到的事,也是这份账簿最先替你挡住的事。

**第二层:把开发过程本身变成数据。** 每条都带时间,一条问答一行 JSONL,攒下来就是这个项目一份完整的原始记录。攒够了就能往外看:哪里反复卡住、哪些问题其实是同一个根因、哪类提问效率最低 —— 模式、问题、流程都从这里提炼出来。这一层要时间,越用越有东西可看。

第一层雪中送炭,第二层锦上添花:先让人今天就能接着干活,再让整个过程变得可观察、可度量、可改进。

## 安装

**需要 Claude Code ≥ 2.1.287**(终端;Desktop app 是 2.1.286,它自带一份 Claude Code)。钩子模块是 2.1.287 起的机制,更低的版本引擎不会加载这个模块 —— 插件装了也不记录。查版本:`claude --version`。低到用不了的机器只有 exe 版的 [`didongke/ai-tracedoc`](https://github.com/didongke/ai-tracedoc) 跑得起来。

```
/plugin marketplace add https://github.com/didongke/ai-tracedoc-mods
/plugin install ai-tracedoc-mods@ai-tracedoc-mods
```

**用完整 HTTPS 地址,别用 `didongke/ai-tracedoc-mods` 这个简写。** 简写会被解析成 SSH 地址,而没连过 GitHub 的机器上没有 `github.com` 的 host key —— 克隆又是非交互跑的,没法问你信不信,于是直接 `Host key verification failed`(2026-10-19,一台全新的 macOS 上就这么失败的)。公开仓库走 HTTPS 不需要任何密钥。就是要走 SSH 也行:先在终端手动 `ssh -T git@github.com`,对着 GitHub 公布的指纹核对后回答 yes 会把它写进 `known_hosts`。

装完打开 `/plugin`,标签页下面那行灰字应该写着 `1 mod active · ai-tracedoc-mods`。没有这行就是模块没加载,这时 `/version` 走的是 `commands/version.md` 那条兜底路。

本地目录(开发用):

```bash
claude plugin marketplace add "<插件目录>"
claude plugin install ai-tracedoc-mods@ai-tracedoc-mods
```

> **别和另一份 ai-tracedoc 同时开在一个项目里。** 上面那份 exe 版写的是同一个账簿文件名,而这份没有 append,只能整份读-改-写 —— 两个一起写,在对方读和写之间落下的那条会被抹掉。装了这个就把那边停掉(`claude plugin disable ai-tracedoc`),反之亦然。想两个都留着对比,把 `hooks/tracedoc.js` 里的 `SUFFIX` 改成别的名字。

### 更新

会话里就能更新,不必退出会话,也不必重启:

```
/plugin marketplace update ai-tracedoc-mods   # 刷新这个 marketplace
/reload-plugins                               # 让新的那份在当前会话里生效
```

也可以打开 `/plugin`:Marketplaces 标签 → 选中 → **Update marketplace**,或 Installed 标签 → 选中插件 → **Update now**。**没有 `/plugin update <名字>` 这个命令** —— 官方文档里 `update`、`init`、`details`、`prune`、`eval`、`test` 都**没有会话形态**,面板里那个是动作、不是命令。关掉 `/plugin` 面板时若有待生效的改动,它会自己替你跑一次 `/reload-plugins`。生效了没有,看 `/version` 报的号。

第三方 marketplace **默认不自动更新**(只有 Anthropic 官方的会),想让它自己跟上就在 Marketplaces 标签里开 **Enable auto-update**;开着的时候更新会在你发第一条消息后十分钟内随机发生,会话里会提示 `Plugin updated: … · Run /reload-plugins to apply`。

**直接改这个仓库那份(本地目录 marketplace)时,"更新"这一步不存在** —— 引擎读的就是工作树里的文件,改完 `/reload-plugins` 就行,连版本号都不用动。文档里点名钩子模块会被 `/reload-plugins` 换掉,所以改完当场就能用。reload 是重新加载:`register` 再跑一遍、`session.start` 再触发一次、内存里的计数器清零 —— 这个模块为此把待答的提问镜像进了 `$.store`(见代码里 `savePending` 上面那段注释),所以 reload 落在提问和回答之间也不会把那一轮弄丢;账簿的会话状态也在 `$.store` 里,所以 reload **不会**多写一个 `## 标题`。

## 使用

在被记录的项目里:

| 命令 | 作用 |
| --- | --- |
| `/ai-tracedoc-mods:on` | 开始记录(创建 `.tracedoc-on`) |
| `/ai-tracedoc-mods:off` | 停止记录(删除 `.tracedoc-on`) |
| `/ai-tracedoc-mods:version` | 显示版本 |

`version` 由**模块自己回答**(钩子拦下这个命令,返回字符串),所以引擎直接打印、不经过模型:

```
ai-tracedoc-mods: 0.5.4-mods.1
```

数字是模块里的常量,和状态文件报的是同一个,也和 `plugin.json` 一致(这条由 `test/run.mjs` 守着)。`commands/version.md` 还在,但它的正文只在模块没加载时才跑 —— 那才是会经过模型的那条路。

然后正常提问。每个问答写进项目根目录的**两份**文件:

```
<YYYYMMDD>-<项目名>-tracedoc.md     人翻阅的账簿
<YYYYMMDD>-<项目名>-tracedoc.jsonl  机器读的每一行
```

超过 200 KiB 时新会话会开新卷 `<YYYYMMDD>-<项目名>-tracedoc-02.md`,JSONL 同名跟上(`-02.jsonl`),并在旧卷末尾留下 `Continued in:` 链接。

### 账簿里的一条(Markdown)

一个条目就是三样东西 —— 时间、问题、回答。标签各占一行,正文从下一行开始:

```
**Question:** 2026-10-15 09:26
这个问题是什么

**Answer:**
回答和结论
```

标签行上只有标签(Question 那行带提问时刻),所以问题或回答再长也不会跟标签挤在同一行。

### 一行(JSONL)

一行一条,正好三个字段:

```json
{"time":"2026-10-15T09:26:07+08:00","question":"…","answer":"…"}
```

- `time` 是**提问那一刻**,ISO 8601 带本机时区偏移 —— 和账簿里那行是同一瞬,只是账簿只记到分钟
- **只写答完的问答。** 没等到答案的提问、没记上的轮次,都不在里面,只在账簿里
- 中文原样写(不转成 `\uXXXX`),换行和引号按 JSON 规则转义,所以一条再长也始终是一行
- **没有表头行**,`jq` 读整个文件不用跳过第一行。装这个插件之前的历史不在里面 —— 它从自己记下的第一条开始,和"没有补记"是同一条原则
- 卷多了以后别用 `cat *-tracedoc.jsonl` 拼:文件名按字节序排,`-02.jsonl` 里那个 `-` 排在基础卷的 `.` 前面,拼出来第二卷反倒在前。要按时间读就把文件显式列出来

按条件过滤,比如挑出提到 SAC 的那些问题的时间:

```
jq -r 'select(.question | test("SAC")) | [.time, (.question | split("\n")[0])] | @tsv' *-tracedoc.jsonl
```

`jq` 不是随系统来的(本机就没装),没装也能读,node 就行,和上面那条等价:

```
node -e 'const fs=require("fs");for(const f of process.argv.slice(1))fs.readFileSync(f,"utf8").split("\n").filter(Boolean).map(JSON.parse).filter(o=>/SAC/.test(o.question)).forEach(o=>console.log(o.time+"\t"+o.question.split("\n")[0]))' *-tracedoc.jsonl
```

## 记什么、不记什么

**只记人写的问题和模型的回答。** 判据有两条,两条都得看,少一条就漏:

- **谁写的。** `origin.kind` 报 `composer` 就是人(transcript 里报 `human`,两种都收)。光看 door 不够:引擎自己也往 `prompt` 这扇门里塞消息,只在 `origin` 里报自己是谁 —— 只看 door 的话,一条后台任务完成通知(`<task-notification>`,带着 task id)会被当成提问记下。
- **它是什么。** 命令的记录行反过来:**插件命令**(`/on`、`/off`)的记录行报的是**人的** origin,靠 origin 认它就会把它收下 —— 0.5.3 就是这么漏的。所以命令靠**开头**认:一行以 `<command-message>`、`<command-name>`、`<local-command-caveat>` 或 `<local-command-stdout>` 开头,就是引擎的命令记录,不收(内置命令的记录行连 origin 都没有,`/model` 那条就是,两种都挡得住)。**"以……开头"是这条判据的全部** —— 提问里引用一段账簿记录(把条目粘进来问)也带着 `<command-message>`,那是提问,照收。

其余的 —— 引擎的通知、system-reminder、工具结果、别的会话发来的消息 —— 一条都不进账簿,连"这一轮有东西可记"都不算。这些都是从本机逐行核出来的行形状,不是猜的:0.5.3 漏掉的那种行,本机留着实物 —— 21:09 那条 `/on` 的 transcript 行写着 `origin.kind=human`。

回答那一格是**模型这一轮的最终答复**(`turn.complete` 的 `answer`),不是 transcript —— 不含工具输出、不含思考过程;一次提问没等到答案就收尾,留下的是一个空的 `**Answer:**`。子代理(subagent)的行不算,记的是你正在对话的这一条线。

一轮只留一条提问。`pending` 只有一个槽,同一轮里后到的顶掉先到的 —— 所以先敲命令、紧接着写正文提问时,进账簿的是正文那条。整轮就是命令的(单独一次 `/on`、一次 `/version`),这一轮从头到尾没有提问,也就不进账簿;它记在状态文件的 `commandTurnsSkipped` 里,和"提问丢了"(`orphanAnswers`)分开数。

## 限制

1. **没有补记。** 每轮当场拿到,拿不到就永远拿不到 —— 补不回来,但会**写进账簿**:下一轮成功记录时,账簿里会出现一行
   `> ⚠ TraceDoc: a turn went unrecorded — <位置> failed at <时间>: <原因>`。
   丢东西不瞒着,但确实丢了。这是用韧性换"不被 SAC 拦"。
2. **同一项目两个会话会互相覆盖。** 没有锁,只有模块内一条 promise 链,串起的是**单个会话**的钩子 —— 同时开两个会话写同一个项目,谁在对方读-写之间落笔就抹掉谁。
3. **会话标题退化成首问**(压平到一行、截 40 字)。
4. **提问时间是钩子运行时刻**,不是提问时刻;差毫秒级。
5. **换个加载身份会多写一个 `## 标题`。** 会话状态存在引擎的 store 里,按加载身份分开(`--plugin-dir` 指同一份代码 / 装进插件目录),身份一变,下一次记录就被当成新会话 —— 条目一条不丢,只是多出一个标题。

## 诊断

插件目录下有个 `.tracedoc-mods-status.json`,每轮重写。它是给"怎么没记上"用的,平时不用看:

- `updatedAt` / `session` / `volume` —— 这份文件是哪个会话、哪个实例、写进哪一卷的时候写下的。配上 `version`,"刚改完代码,现在跑的是不是新的那份"不用再去翻文件时间。`volume` 在这个实例还没记过东西时是 `null`
- `recorded` / `turns` / `skippedDisabled` —— 记了几轮 / 发生了几轮 / 因为项目没开记录跳过几轮
- `jsonlRows` / `jsonlFailures` —— 写了几行 JSONL / 失败几次。`recorded` 比 `jsonlRows` 大是正常的(没答的提问只在账簿里);`jsonlFailures` 大于 0 就是那一轮**只进了账簿**,`jsonlErrors` 有原文
- `commandTurnsSkipped` —— 整轮是斜杠命令、本来就没有东西可记的轮数(单独一次 `/on`、一次 `/version`)。它涨是正常的,和下一项分开数,就是为了让"没东西可记"不冒充"丢了东西"
- `orphanAnswers` —— **大于 0 就是真丢了东西**
- `rowsNotRecorded` 和 `appendShapes` —— 每一条 `session.append` 行的形状计数,用来核对判据。人写的 prompt 是 `origin=composer`;哪天冒出 `prompt | … | origin=<别的>` 在涨、而 `turns` 不涨,就是引擎换叫法了,判据得跟着改 —— 不收认不出的 origin 换来了"只记人写的",代价是这种情形会**静默地不记录**,这一项就是用来发现它的
- `hookFailures` 和 `unreportedFailures` —— 钩子自己出错时的原文

JSONL 写失败**不会**在账簿里留 ⚠ 行。那行的意思是"这一轮没记上",而那一轮记上了 —— 只是没写进 JSONL。所以它只出现在这个文件里,和上面那些分开数。

## 测试

```
node test/run.mjs hooks/tracedoc.js
```

用假的 `$` 驱动记录器,断言**账簿的字节**:卷头、会话标题、标签独占一行而正文从下一行开始、同会话追加不重写标题、200 KiB 滚卷、未答提问的收尾、写盘失败时的缺口行、以及哪些 `session.append` 行算提问(命令轮在里面:它不进账簿,也不算丢提问;反过来,提问里引用一段命令记录要照记)。JSONL 那边断言每一行:三个字段的顺序与内容、时间取的是提问那一刻、中文不被转义成 `\uXXXX`、回答里的换行不把一行拆成两行、未答的提问和丢掉的轮次都不写行、滚卷时不给旧卷补造 JSONL。状态文件那边断言它报的版本、卷号和计数。需要 Node,无依赖。

## 文件

```
.claude-plugin/plugin.json        插件清单
.claude-plugin/marketplace.json   本地 marketplace 清单
hooks/hooks.json                  声明 modules: ["./tracedoc.js"]
hooks/tracedoc.js                 记录器本体(唯一的实现文件,也回答 /version)
commands/{on,off}.md              开、关两个命令
commands/version.md               声明 /version;正文是模块没加载时的兜底
tsconfig.json                     编辑器类型检查入口;extends 引擎加载模块时
                                  写出的 .claude-plugin/types/(只在本机存在)
test/run.mjs                      格式护栏,不是插件的运行时表面
```

加载器有一条硬约束:它会在运行前静态读这个模块的源码,而"把 `on`、`$` 或 `$.env` 不按字面拼写"的模块不会被加载 —— 所以代码里没有别名、没有解构 `$`、没有拼出来的事件名。代码里凡是**故意**这么写的地方都标了出处,凡是**明知有代价**的地方都写了代价 —— 提问判据那段(为什么不能只看 door)、卷号的解析、ambiguous 卷为什么宁可报错,都是这样写在代码里的。
