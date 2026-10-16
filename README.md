# ai-tracedoc

把每个项目里的 Claude Code 问答记进一份 TraceDoc 账簿。

这是 ai-tracedoc 的 **hooks module 版**:同样的账簿文件名、同样的命令、同样的 `.tracedoc-on` 开关,但作为 Claude Code 的钩子模块运行,所以**没有二进制** —— 也就没有东西会让 Windows Smart App Control 拦下。每个问答同时写两份:人看的 Markdown 账簿,机器读的 JSONL。

**Windows、Linux、macOS 三个平台跑的是同一份代码。** 源码里没有一处平台分支,`basename`/`join` 自己认两种分隔符,也没有要编译、要签名、要按平台分发的东西(0.3.x 得给每个平台各带一份二进制)。Windows 和 Linux 上实际跑过、写出过账簿;macOS 没实测过 —— 那边「没有平台分支」是读代码读出来的,不是跑出来的。

## 安装

**需要 Claude Code ≥ 2.1.287**(终端;Desktop app 是 2.1.286,它自带一份 Claude Code)。钩子模块是 2.1.287 起的机制,更低的版本引擎不会加载这个模块 —— 插件装了也不记录。查版本:`claude --version`。升不上去的机器只能用 0.3.x(exe 版)。

```
/plugin marketplace add didongke/ai-tracedoc-mods
/plugin install ai-tracedoc-mods@ai-tracedoc-mods
```

装完打开 `/plugin`,标签页下面那行灰字应该写着 `1 mod active · ai-tracedoc-mods`。没有这行就是模块没加载,这时 `/version` 走的是 `commands/version.md` 那条兜底路。

本地目录(开发用):

```bash
claude plugin marketplace add "<插件目录>"
claude plugin install ai-tracedoc-mods@ai-tracedoc-mods
```

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
ai-tracedoc-mods: 0.5.3-mods.1
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
- **没有表头行**,`jq` 读整个文件不用跳过第一行。所以从 0.3.x 接手一个老项目时,这个文件从**本版本记下的第一条**开始,旧历史不在里面 —— 和"没有补记"是同一条原则
- 卷多了以后别用 `cat *-tracedoc.jsonl` 拼:文件名按字节序排,`-02.jsonl` 里那个 `-` 排在基础卷的 `.` 前面,拼出来第二卷反倒在前。要按时间读就把文件显式列出来

按条件过滤,比如挑出提到 SAC 的那些问题的时间:

```
jq -r 'select(.question | test("SAC")) | [.time, (.question | split("\n")[0])] | @tsv' *-tracedoc.jsonl
```

`jq` 不是随系统来的(本机就没装),没装也能读,node 就行,和上面那条等价:

```
node -e 'const fs=require("fs");for(const f of process.argv.slice(1))fs.readFileSync(f,"utf8").split("\n").filter(Boolean).map(JSON.parse).filter(o=>/SAC/.test(o.question)).forEach(o=>console.log(o.time+"\t"+o.question.split("\n")[0]))' *-tracedoc.jsonl
```

## 维护状态

**只有这个版本在维护。** 0.3.x(exe 版,[`didongke/ai-tracedoc`](https://github.com/didongke/ai-tracedoc))自 2026-10-16 起冻结 —— 那边不再修问题、不再加功能、不再发版,新东西只落在这里。那边仓库继续挂着,因为 Claude Code 低于 2.1.287 的机器加载不了钩子模块,只有它跑得起来。

它和这个版本的关系,下一节说清楚;最要紧的一条是**别两个一起开**。

## 和 0.3.x(exe 版)的区别

**不要两个一起开。** 两者写的是同一个文件名,而这个版本因为没有 append 只能整份读-改-写,0.3.x 是在锁里 append —— 两个同时写,在对方读和写之间落下的那条会被抹掉。装了这个就把 0.3.x 停掉(`claude plugin disable ai-tracedoc`),反之亦然。想两个都留着对比的话,把 `hooks/tracedoc.js` 里的 `SUFFIX` 改成别的名字。

交接的那一刻账簿里会多出一个 `## 标题`:两边各存各的会话状态(0.3.x 用项目里的 `.tracedoc-state.json`,这个版本用引擎的 store),换了 build 之后的第一次记录会被当成新会话。本机 2026-10-15 换的时候就是这样,账簿里多出来的那一个标题是它,条目一条没丢。同一版本换个加载身份(装进插件目录 vs `--plugin-dir` 指同一份代码)也一样,状态不通用。

**条目的排版也不再一样了。** 文件名、卷号、卷头、会话标题全都相同;不同的是一条记录怎么排:

```
0.3.x:  **Question:** 2026-10-15 09:26 · 问题写在标签这一行
        **Answer:** 回答也写在标签这一行

这个版: **Question:** 2026-10-15 09:26
        问题从下一行开始

        **Answer:**
        回答也从下一行开始
```

所以跨版本接手的项目,`.md` 会是上半截旧排版、下半截新排版。两种都读得懂,但一份文件里能看到两种 —— 这也是"别两个一起开"的另一个理由。旧账簿里已经写下的字节不会被改动,只往后追加。

**多一份 JSONL。** 0.3.x 只写账簿;这个版本每个答完的问答同时写一行 JSONL,给程序和 AI 读。

其余区别,按对你有影响的程度排:

1. **没有补记。** exe 版靠 transcript 的字节 offset,任何时候能跑起来就把缺的补上。这个版本是每轮当场拿到,拿不到就永远拿不到 —— 补不回来,但会**写进账簿**:下一轮成功记录时,账簿里会出现一行
   `> ⚠ TraceDoc: a turn went unrecorded — <位置> failed at <时间>: <原因>`。
   丢东西不瞒着,但确实丢了。这是用韧性换"不被 SAC 拦"。
2. **同一项目两个会话会互相覆盖。** 没有锁,只有模块内一条 promise 链,串起的是**单个会话**的钩子。exe 版有真锁,最坏是重复记录 而不是覆盖。
3. **会话标题退化成首问**(压平到一行、截 40 字)。没有 `ai-title` 事件的等价物 —— 也就是 exe 版没有标题记录时用的那个兜底。
4. **提问时间是钩子运行时刻**,不是提问时刻;差毫秒级。
5. **斜杠命令的记录进不进账簿,两边不一样。** 0.3.x 读的是 transcript,那里命令的记录行带的是**人的** origin,于是被当成一次提问记下;这个版本看到的是实时行,它报 `origin=engine`,不收。同一个项目换过 build 的话,账簿里早先那些 `/on`、`/exit` 会留着 —— 已经写下的字节不动,只往后不再写新的。

判据是 `origin.kind`,也就是**这一行是谁写的**:人写的报 `composer`(transcript 里报 `human`,两种都收)。**光看 door 不够** —— 引擎自己也往 `prompt` 这扇门里塞消息,只在 `origin` 里报自己是谁;早先只看 door,结果把一条后台任务完成通知(`<task-notification>`,带着 task id)记成了一次提问。现在 origin 不认识的行一律不收,**没有例外**:斜杠命令的记录行和输出行在本机都是 `origin=engine`,所以命令本身不进账簿。代码里仍然认 `<command-message>` 那个标记,但只用它判断"这一轮是命令轮",不是拿它收行 —— 一条被收下的问题必须靠 origin,不靠长什么样。这些都是从本机逐行核出来的行形状,不是猜的。

一轮只留一条提问。`pending` 只有一个槽,同一轮里后到的顶掉先到的 —— 所以先敲命令、紧接着写正文提问时,进账簿的是正文那条。整轮就是命令的(单独一次 `/on`、一次 `/version`),这一轮从头到尾没有提问,也就不进账簿;它记在状态文件的 `commandTurnsSkipped` 里,和"提问丢了"(`orphanAnswers`)分开数。

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

用假的 `$` 驱动记录器,断言**账簿的字节**:卷头、会话标题、标签独占一行而正文从下一行开始、同会话追加不重写标题、200 KiB 滚卷、未答提问的收尾、写盘失败时的缺口行、以及哪些 `session.append` 行算提问(命令轮在里面:它不进账簿,也不算丢提问)。JSONL 那边断言每一行:三个字段的顺序与内容、时间取的是提问那一刻、中文不被转义成 `\uXXXX`、回答里的换行不把一行拆成两行、未答的提问和丢掉的轮次都不写行、滚卷时不给旧卷补造 JSONL。状态文件那边断言它报的版本、卷号和计数。需要 Node,无依赖。

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

加载器有一条硬约束:它会在运行前静态读这个模块的源码,而"把 `on`、`$` 或 `$.env` 不按字面拼写"的模块不会被加载 —— 所以代码里没有别名、没有解构 `$`、没有拼出来的事件名。凡是**故意**照抄 Go 原版的地方(卷号解析、ambiguous 卷报错、提问判据)都标了出处;凡是**明知不同**的地方都写了代价 —— 条目的排版就是一处:它以前是照抄来的,现在不是了,所以代码里那段"必须拼对空行才不分叉"的注释也跟着删了。
