# ai-tracedoc

把每个项目里的 Claude Code 问答记进一份 TraceDoc 账簿。

这是 ai-tracedoc 的 **hooks module 版**:同样的账簿、同样的命令、同样的 `.tracedoc-on` 开关,但作为 Claude Code 的钩子模块运行,所以**没有二进制** —— 也就没有东西会让 Windows Smart App Control 拦下。

## 安装

```
/plugin marketplace add didongke/ai-tracedoc-mods
/plugin install ai-tracedoc-mods@ai-tracedoc-mods
```

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
ai-tracedoc-mods: 0.4.0-mods.1
```

数字是模块里的常量,和状态文件报的是同一个,也和 `plugin.json` 一致(这条由 `test/run.mjs` 守着)。`commands/version.md` 还在,但它的正文只在模块没加载时才跑 —— 那才是会经过模型的那条路。

然后正常提问。问答会写进项目根目录的账簿:

```
<YYYYMMDD>-<项目名>-tracedoc.md
```

超过 200 KiB 时新会话会开新卷 `<YYYYMMDD>-<项目名>-tracedoc-02.md`,并在旧卷末尾留下 `Continued in:` 链接。

## 和 0.3.x(exe 版)的区别

**不要两个一起开。** 两者写的是同一个文件名,而这个版本因为没有 append 只能整份读-改-写,0.3.x 是在锁里 append —— 两个同时写,在对方读和写之间落下的那条会被抹掉。装了这个就把 0.3.x 停掉(`claude plugin disable ai-tracedoc`),反之亦然。想两个都留着对比的话,把 `hooks/tracedoc.js` 里的 `SUFFIX` 改成别的名字。

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
- `orphanAnswers` —— **大于 0 就是真丢了东西**
- `rowsNotRecorded` 和 `appendShapes` —— 每一条 `session.append` 行的形状计数,用来核对判据
- `hookFailures` 和 `unreportedFailures` —— 钩子自己出错时的原文

## 测试

```
node test/run.mjs hooks/tracedoc.js
```

用假的 `$` 驱动记录器,断言**账簿的字节**:卷头、会话标题、Go 版 `FormatEntries` 那个 parts-then-join 产生的双空行、同会话追加不重写标题、200 KiB 滚卷、未答提问的收尾、写盘失败时的缺口行、以及哪些 `session.append` 行算提问。需要 Node,无依赖。

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

加载器有一条硬约束:它会在运行前静态读这个模块的源码,而"把 `on`、`$` 或 `$.env` 不按字面拼写"的模块不会被加载 —— 所以代码里没有别名、没有解构 `$`、没有拼出来的事件名。凡是**故意**照抄 Go 原版的地方(账簿格式、卷号解析、ambiguous 卷报错)都标了出处;凡是**明知不同**的地方都写了代价。
