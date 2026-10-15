# ai-tracedoc — hooks-module build

ai-tracedoc 的 **mods 版**(hooks module),用来和 0.3.4 的二进制版对比着试用。

账簿格式、200 KiB 滚动、`.tracedoc-on` 开关、三个命令的语义**全部照抄 0.3.x**。变的是两件事:问答从哪来(session 事件,而不是读 transcript),以及怎么落盘(`$.fs` 整份读写,而不是带锁的 append)。

## 怎么试用

两种装载方式,`.tracedoc-on` 都要在**被记录的项目**里:

```bash
# 只加载这个插件,别人的插件不受影响
claude --plugin-dir "D:\02-Test\03-AI\Claude\20261015-检查Proxy代码\code\ai-tracedoc-mods"

# 或者走 marketplace
claude plugin marketplace add "D:\...\code\ai-tracedoc-mods"
claude plugin install ai-tracedoc-mods@ai-tracedoc-mods
```

装好后:在被记录的项目里运行 `/ai-tracedoc-mods:on`,然后正常提问。

**和已装的 0.3.4 exe 版并存**:两者读同一个 `.tracedoc-on`,互不干扰。账簿文件名故意分开 —— exe 版写 `*-tracedoc.md`,这个版本写 `*-tracedocmod.md`,所以谁也不会覆盖谁,并排 diff 就能看出两份记录是否一致。正式替换时把 `hooks/tracedoc.js` 里的 `SUFFIX` 改回 `'tracedoc.md'` 即可(文件里有注释标出)。

## 试用期该看什么

**1. 先看 `appendShapes`。** 这是**唯一**一个已知的、需要这次试用才能定下来的设计决定:

提问白名单目前只有 `prompt`,**没有 `command`** —— 而 exe 版账簿里 `/ai-tracedoc:on` 是被记成一条 Question 的。原因:引擎文档说 `session.append` 的行包括"人的提问、**斜杠命令的记录和它的输出**",而 door 取值里没有任何一个能区分"命令记录"和"命令输出",两者都是 `command`。盲开白名单可能给一条 `/on` 写两条账簿条目,那是污染数据;不开只是少记一条命令行,那是可见的差异。

所以:请在试用时**运行一次 `/ai-tracedoc-mods:on` 或 `/off`**,然后看 `appendShapes` 里 `command | …` 是几行、`doorSamples.command` 是什么。如果是两行而且 `role` / `isMeta` / `origin` 有区别,把区分字段加进白名单即可(代码里那段注释写了确切做法);如果只有一行,直接加。

`queue` **不应该**加进来,永远:它是队列记录,文档明说那是"对话从不保留的行",写进账簿就是记录机器动作而非对话。

**2. 账簿 diff。** 同一段对话,两份账簿应当逐字节相同(除了文件名和标题行)。任何差异都是要修的东西 —— 最可能的来源是"必须容忍的偏差"里的前两条。

**3. `<插件目录>/.tracedoc-mods-status.json`。** 每次记录都会重写,里面是试用真正要看的数据:

| 字段 | 说明 |
| --- | --- |
| `appendsByDoor` | 每个 `session.append` 的 `door` 各出现了多少次 |
| `appendShapes` | 按 `door \| role \| isMeta \| origin` 分组计数。**最关键的一项** |
| `doorSamples` | 非提问 door 的文本前 60 字。用来判断这个 door 到底装着什么 |
| `turnReasons` | `answer` / `aborted` / `refusal` / `error` 各多少 |
| `recorded` | 真正写进账簿的轮数。`recorded` 应当等于 `turns` 减去 `skippedDisabled` |
| `skippedDisabled` | 因为项目里没有 `.tracedoc-on` 而跳过的轮数 |
| `orphanAnswers` | 有回答但手里没有提问的轮数。**大于 0 就是真丢了东西**,值得查 |
| `subagentTurnsSkipped` / `subagentAppendsSkipped` | 子代理的行被跳过的次数,正常 |
| `gapsReported` | 写进账簿的缺口告警行数 |
| `hookFailures` | 钩子自身抛错/超时的次数。大于 0 说明 `unreportedFailures` 里有原文 |
| `aborted` | 被用户打断的轮数 |

**4. 账簿里有没有 `> ⚠ TraceDoc:` 开头的行。** 有就说明某一轮没记上,后面跟着失败位置、时间和原因。这是这个版本对"丢数据"的交代方式 —— 补不回来,但不会瞒着。

## 必须容忍的偏差(设计如此,不是 bug)

1. **没有补记。** exe 版靠 transcript 的字节 offset,在任何一次能跑起来的时候把缺的全补上 —— 上午被 SAC 拦了一上午,11:28 一放行就照 offset 全部追平。这个版本是每轮当场拿到,拿不到就永远拿不到。这是用韧性换"不被 SAC 拦",是我认为值得的一换,但它确实是一换。
2. **同一项目两个会话会互相覆盖。** `$.fs` 没有 append、没有锁、没有 rename,账簿只能整份读-改-写,靠模块内的 promise 链把**单个会话**的钩子串起来。同项目并发的第二个 Claude Code 会话不在那条链上。exe 版有真锁,只会重复记录,不会覆盖。要试这条,开两个会话同时问。
3. **标题退化成首问。** 没有 `ai-title` 事件的等价物,所以 `## 2026-10-15 · 标题` 里的标题永远是首问压平后截到 40 字 —— 也就是 exe 版**没有标题记录时**用的那个兜底。
4. **时间戳是钩子运行时刻**,不是提问时刻。事件本身不带时间戳;差的是毫秒级,但它是差。
5. **热重载会重置模块状态。** 待回答的提问已经镜像进 `$.store`,所以重载跨过一轮也还能记上;但正在进行中的那次账簿写入会被打断(单项目内的窗口,极小)。

## 已自测的部分

```
node test/run.mjs hooks/tracedoc.js
```

`test/run.mjs` 用一个假的 `$` 驱动记录器,断言的是**账簿的字节**,不是"没抛异常"。覆盖 26 项:

- 全新项目第一轮 → 账簿内容逐字节符合 0.3.x 格式(卷头、`## 日期 · 标题`、`<!-- session: -->`、`**Question:** 时间 · 文本`、以及 Go 版那个 parts-then-join 产生的双空行)
- 同一会话第二轮 → 直接追加,**不**重复写会话标题
- 没有 `.tracedoc-on` → 一个字都不写,但计入 `skippedDisabled`
- 新会话到达超过 200 KiB 的卷 → 建 `-02.md`、写 `Continued from`、给旧卷补 `Continued in` 页脚
- 提问未获回答时 `session.end` → 只记问题,不写 `**Answer:**` 行
- 某一轮写盘失败 → 不半写;下一轮把 `> ⚠ TraceDoc: a turn went unrecorded — …` 写进账簿,原文包含失败位置和原因
- `command` / `queue` 的行 → 不进账簿,但计入 `appendShapes` 和 `doorSamples`,`prompt` 的文本不被采样

**没被测到的**,也就是要靠在你的机器上真跑来验的:真实引擎给的 `door` 取值、`agentId` 过滤是否够、热重载、以及 `$.fs` / `$.store` 的真实行为。测试台只能证明逻辑对,证明不了这些。

## 版本号

`/ai-tracedoc-mods:version` 沿用原版实现:版本 = 安装目录名。marketplace 安装时目录名就是版本号,所以正常;但**用 `--plugin-dir` 从源码目录加载时它打印的是目录名**(`ai-tracedoc-mods`)。试用期真正的版本号在 `hooks/tracedoc.js` 顶部的 `VERSION`,也写在 `.tracedoc-mods-status.json` 里。

## 文件

```
.claude-plugin/plugin.json        插件清单
.claude-plugin/marketplace.json   本地 marketplace 清单
hooks/hooks.json                  声明 modules: ["./tracedoc.js"]
hooks/tracedoc.js                 记录器本体(唯一的实现文件)
commands/{on,off,version}.md      三个命令,语义同 0.3.x
test/run.mjs                      格式回归护栏,不是插件的运行时表面
```

`hooks/tracedoc.js` 里凡是**故意**照抄 Go 原版的地方(账簿格式、卷号解析、205 行那个 parts-then-join、ambiguous 卷报错)都标了出处;凡是**明知不同**的地方都写了代价。加载器有一条硬约束值得知道:它会在运行前静态读这个模块的源码,而"把 `on`、`$` 或 `$.env` 不按字面拼写"的模块不会被加载 —— 所以没有别名、没有解构、没有拼出来的事件名。
