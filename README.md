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

## 使用

在被记录的项目里:

| 命令 | 作用 |
| --- | --- |
| `/ai-tracedoc-mods:on` | 开始记录(创建 `.tracedoc-on`) |
| `/ai-tracedoc-mods:off` | 停止记录(删除 `.tracedoc-on`) |
| `/ai-tracedoc-mods:version` | 显示版本 |

`version` 由**模块自己回答**(钩子拦下这个命令,返回字符串),所以引擎直接打印、不经过模型:

```
ai-tracedoc-mods: 0.5.0-mods.1
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

按条件过滤,比如挑出提到 SAC 的那些问题的时间:

```
jq -r 'select(.question | test("SAC")) | [.time, (.question | split("\n")[0])] | @tsv' *-tracedoc.jsonl
```

## 和 0.3.x(exe 版)的区别

**不要两个一起开。** 两者写的是同一个文件名,而这个版本因为没有 append 只能整份读-改-写,0.3.x 是在锁里 append —— 两个同时写,在对方读和写之间落下的那条会被抹掉。装了这个就把 0.3.x 停掉(`claude plugin disable ai-tracedoc`),反之亦然。想两个都留着对比的话,把 `hooks/tracedoc.js` 里的 `SUFFIX` 改成别的名字。

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

判据上反而更准:提问取 `origin.kind === 'human'`(和 exe 同一条判据),所以斜杠命令的**记录行**会被记成一条 Question,而它的**输出行**(`origin=undefined`)不会 —— 这是从本机 transcript 逐行核出来的,不是猜的。

## 诊断

插件目录下有个 `.tracedoc-mods-status.json`,每轮重写。它是给"怎么没记上"用的,平时不用看:

- `recorded` / `turns` / `skippedDisabled` —— 记了几轮 / 发生了几轮 / 因为项目没开记录跳过几轮
- `jsonlRows` / `jsonlFailures` —— 写了几行 JSONL / 失败几次。`recorded` 比 `jsonlRows` 大是正常的(没答的提问只在账簿里);`jsonlFailures` 大于 0 就是那一轮**只进了账簿**,`jsonlErrors` 有原文
- `orphanAnswers` —— **大于 0 就是真丢了东西**
- `rowsNotRecorded` 和 `appendShapes` —— 每一条 `session.append` 行的形状计数,用来核对判据
- `hookFailures` 和 `unreportedFailures` —— 钩子自己出错时的原文

JSONL 写失败**不会**在账簿里留 ⚠ 行。那行的意思是"这一轮没记上",而那一轮记上了 —— 只是没写进 JSONL。所以它只出现在这个文件里,和上面那些分开数。

## 测试

```
node test/run.mjs hooks/tracedoc.js
```

用假的 `$` 驱动记录器,断言**账簿的字节**:卷头、会话标题、标签独占一行而正文从下一行开始、同会话追加不重写标题、200 KiB 滚卷、未答提问的收尾、写盘失败时的缺口行、以及哪些 `session.append` 行算提问。JSONL 那边断言每一行:三个字段的顺序与内容、时间取的是提问那一刻、中文不被转义成 `\uXXXX`、回答里的换行不把一行拆成两行、未答的提问和丢掉的轮次都不写行、滚卷时不给旧卷补造 JSONL。需要 Node,无依赖。

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
