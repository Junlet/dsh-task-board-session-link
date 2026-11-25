# dsh-task-board-session-link

中文 | [English](#english)

把**任意会话**放进 DSH 任务看板，并从看板一键跳回那段对话。

它是任务看板（[`@linxin666/dsh-client-ui-task-board`](https://www.npmjs.com/package/@linxin666/dsh-client-ui-task-board)）的一个**外部提供方扩展**：只按看板自己的扩展契约注册，不碰账本、列、定时和执行闸门。

## 用法

**把会话加到看板**：在左侧会话行上右键（或点行尾的「…」），选 **添加到任务看板**。插件会：

1. 以该会话的标题建一张卡片（落在「待办」列）；
2. 把会话引用写进卡片自己的扩展数据；
3. 打开看板，让你立刻看到这张新卡。

**从看板跳回会话**：

- 卡片上的 **会话** 徽标 —— 点一下直接回到那段对话（不会先打开卡片详情）；
- 卡片详情页的 **关联会话** 区块 —— `打开会话` / `改为其他会话`（可从会话列表里搜索标题或 ID）/ `解除关联`。

**给已有的卡挂会话**：打开任意卡片详情 → 关联会话 → `关联会话…` → 在列表里挑一个。

## 安装

```powershell
dsh plugin --profile web add dsh-task-board-session-link
```

需要同时装有任务看板；没有它时本插件保持休眠，界面上不出现任何东西（会话行菜单里也不会多出这一项）。

装完重启一次 DSH。

## 边界

- **关联只记在卡片上**：会话本身不被改动，也没有新建、重命名或归档任何会话。
- **卡片是"代表"，不是"执行入口"**：点卡片上的徽标是回到原会话；点卡片本体的「运行」仍按看板自己的规则开一个新会话（卡片里预置的提示语是"继续该会话的上下文"，但它不会真的接管原会话）。
- **会话被删掉后**卡片里的引用会留下（显示标题或"未命名会话"，点开会失败）；用 `解除关联` 清掉即可。
- 子会话（subagent）与空白会话不出现在选择列表里；用会话行菜单仍然可以添加任意会话。
- 只在 Web / Desktop 图形界面里工作。

## 许可

MIT。

---

<a id="english"></a>
## English

Put **any Session** on the DSH task board, and jump back to that conversation from the board.

It is an **external provider extension** of the task board ([`@linxin666/dsh-client-ui-task-board`](https://www.npmjs.com/package/@linxin666/dsh-client-ui-task-board)): it registers through the board's own extension contract and never touches the ledger, the columns, the schedules, or the run gates.

### Use

**Add a Session** — right-click a Session row in the sidebar (or use its `…` menu) and pick **Add to task board**. The plugin then:

1. creates a card titled after that Session, in the To-do column;
2. stores the Session reference in the card's own integration payload;
3. opens the board so the new card is visible.

**Jump back** — the card's **Session** badge opens that conversation directly, and the card detail page carries a Linked Session block with `Open Session`, `Link a different Session` (searchable), and `Unlink`.

**Link an existing card** — open any card's detail, choose `Link a Session…`, and pick one from the list.

### Install

```powershell
dsh plugin --profile web add dsh-task-board-session-link
```

The task board must be installed; without it this plugin stays dormant and adds nothing to the interface. Restart DSH once after installing.

### Limits

- The link lives on the card only: no Session is created, renamed, or archived.
- The card represents the Session; the board's own **Run** still opens a new conversation under the board's rules.
- Deleting the linked Session leaves the reference on the card (opening it fails); use `Unlink` to clear it.
- Subagent sessions and blank sessions are not offered in the picker, but any Session can still be added from its row menu.

MIT licensed.
