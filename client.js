window.__ModuleLoader__.load({
  id: 'dsh-task-board-session-link',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useState } = React;

    /** Stable extension id; matches the Host half and keys the card payload. */
    const EXTENSION_ID = 'session-link';
    /** The board's center-column panel id, so a created card can be shown at once. */
    const BOARD_PANEL = 'task-board';

    const zh = {
      'menu.add': '添加到任务看板',
      'menu.busy': '正在添加…',
      'menu.failed': '添加失败（任务看板未就绪）',
      'badge.label': '会话',
      'badge.title': '打开关联的会话',
      'detail.title': '关联会话',
      'detail.none': '这张卡还没有关联会话。',
      'detail.open': '打开会话',
      'detail.unlink': '解除关联',
      'detail.choose': '关联会话…',
      'detail.chooseOther': '改为其他会话',
      'detail.search': '搜索会话标题或 ID',
      'detail.empty': '没有匹配的会话',
      'detail.cancel': '取消',
      'detail.failed': '操作失败，请看控制台',
      'detail.link': '关联',
      'detail.running': '运行中',
      'detail.note': '关联只记在卡片上，不改动会话本身。',
      'card.description': '来自会话 {id}。点卡片上的「会话」徽标回到原对话。',
      'card.prompt': '继续会话「{title}」的上下文。',
      'card.untitled': '未命名会话',
    };

    const en = {
      'menu.add': 'Add to task board',
      'menu.busy': 'Adding…',
      'menu.failed': 'Could not add (task board not ready)',
      'badge.label': 'Session',
      'badge.title': 'Open the linked Session',
      'detail.title': 'Linked Session',
      'detail.none': 'This card has no linked Session yet.',
      'detail.open': 'Open Session',
      'detail.unlink': 'Unlink',
      'detail.choose': 'Link a Session…',
      'detail.chooseOther': 'Link a different Session',
      'detail.search': 'Search Session title or ID',
      'detail.empty': 'No matching Session',
      'detail.cancel': 'Cancel',
      'detail.failed': 'The action failed; see the console',
      'detail.link': 'Link',
      'detail.running': 'running',
      'detail.note': 'The link lives on the card only; the Session itself is untouched.',
      'card.description': 'Linked to Session {id}. Use the card’s session badge to jump back.',
      'card.prompt': 'Continue the conversation “{title}”.',
      'card.untitled': 'Untitled Session',
    };

    /**
     * Pick the interface language from the document.
     * @returns 'zh' or 'en'.
     */
    function detectLanguage() {
      let raw = '';
      try {
        raw = (typeof document !== 'undefined' && document.documentElement.lang) || '';
        if (raw === '' && typeof navigator !== 'undefined') raw = navigator.language || '';
      } catch {
        raw = '';
      }
      return /^zh/i.test(raw) ? 'zh' : 'en';
    }

    const LANGUAGE = detectLanguage();
    const DICTIONARY = LANGUAGE === 'zh' ? zh : en;

    /**
     * Resolve one interface string, substituting `{name}` placeholders.
     * @param key - dictionary key.
     * @param vars - replacement values.
     * @returns localized text.
     */
    function tr(key, vars) {
      const template = DICTIONARY[key] ?? en[key] ?? key;
      if (vars === undefined) return template;
      return String(template).replace(/\{(\w+)\}/g, (whole, name) =>
        vars[name] === undefined ? whole : String(vars[name]),
      );
    }

    /**
     * Read a service without throwing when it is absent.
     * @param ctx - client context.
     * @param name - service name.
     * @returns the service, or undefined.
     */
    function service(ctx, name) {
      try {
        return ctx.get(name);
      } catch {
        return undefined;
      }
    }

    /** The board's browser-half capability face, when the board is loaded. */
    const boardOf = ctx => service(ctx, 'taskBoard');

    /**
     * Read this extension's payload off one card.
     * @param task - the board's task record.
     * @returns `{ sessionId, title }` when a Session is linked, otherwise null.
     */
    function linkOf(task) {
      const payload = task?.integrations?.[EXTENSION_ID];
      if (payload === null || typeof payload !== 'object') return null;
      const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
      if (sessionId.length === 0) return null;
      const title = typeof payload.title === 'string' ? payload.title : '';
      return { sessionId, title };
    }

    /**
     * Show one Session: leave the board panel, then select the Session.
     * @param ctx - client context.
     * @param sessionId - Session to display.
     */
    function openSession(ctx, sessionId) {
      const layout = service(ctx, 'layout');
      try {
        layout?.selectPanel?.(null);
      } catch {
        // A layout without the board panel still navigates below.
      }
      try {
        ctx.get('uiWorkspace')?.openSession(sessionId);
      } catch (error) {
        console.warn('[task-board-session-link] could not open the Session:', error);
      }
    }

    /**
     * Dispatch one action to this plugin's Host half through the board's channel.
     * @param ctx - client context.
     * @param action - provider action name.
     * @param payload - action payload.
     * @returns the routed action result.
     */
    async function dispatchAction(ctx, action, payload) {
      const face = boardOf(ctx);
      if (face === undefined || typeof face.dispatch !== 'function') {
        throw new Error('the task board is not available');
      }
      const accepted = await face.dispatch({ extensionId: EXTENSION_ID, action, payload });
      if (accepted === false) throw new Error('the task board refused the action');
      return accepted;
    }

    /**
     * Read the Session catalog rows the picker lists.
     * @param ctx - client context.
     * @returns newest-first Session rows.
     */
    function readSessions(ctx) {
      const sessions = service(ctx, 'sessions');
      let snapshot;
      try {
        snapshot = sessions?.list?.getSnapshot?.();
      } catch {
        snapshot = undefined;
      }
      const byId = snapshot?.byId;
      if (byId === null || typeof byId !== 'object') return [];
      const rows = [];
      for (const key of Object.keys(byId)) {
        const row = byId[key];
        if (row === null || typeof row !== 'object') continue;
        if (row.origin === 'subagent') continue;
        if (row.blank === true) continue;
        const sessionId = typeof row.sessionId === 'string' ? row.sessionId : key;
        if (typeof sessionId !== 'string' || sessionId.length === 0) continue;
        rows.push({
          sessionId,
          title: typeof row.title === 'string' ? row.title : '',
          updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
          running: row.running === true,
        });
      }
      rows.sort((left, right) => right.updatedAt - left.updatedAt);
      return rows;
    }

    /**
     * Subscribe to the Session catalog.
     * @param ctx - client context.
     * @returns newest-first Session rows, refreshed on every catalog change.
     */
    function useSessionRows(ctx) {
      const [rows, setRows] = useState(() => readSessions(ctx));
      useEffect(() => {
        const list = service(ctx, 'sessions')?.list;
        if (typeof list?.subscribe !== 'function') return undefined;
        const refresh = () => setRows(readSessions(ctx));
        refresh();
        return list.subscribe(refresh);
      }, [ctx]);
      return rows;
    }

    const buttonStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      height: '22px',
      padding: '0 6px',
      border: '0',
      borderRadius: 'var(--dsw-radius-sm)',
      background: 'transparent',
      color: 'var(--dsw-alias-label-secondary)',
      font: 'inherit',
      fontSize: '12px',
      lineHeight: '18px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    };

    const fieldStyle = {
      boxSizing: 'border-box',
      width: '100%',
      border: '0.5px solid var(--dsw-alias-border-l1)',
      borderRadius: 'var(--dsw-radius-sm)',
      background: 'transparent',
      color: 'var(--dsw-alias-label-primary)',
      font: 'inherit',
      fontSize: '12px',
      lineHeight: '18px',
      padding: '4px 6px',
    };

    /**
     * One Session row menu entry: put this Session on the board as a new card.
     * @param props - Session row owner props plus the menu's open-state hook.
     * @returns the menu item, or null when the board is not loaded.
     */
    function SessionMenuEntry(props) {
      const ctx = props.ctx;
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : '';
      const displayTitle = typeof props.displayTitle === 'string' ? props.displayTitle : '';
      const useMenuOpenState = props.useMenuOpenState;
      // The slot injects this hook, so it is called unconditionally during
      // render like every other injected seat; a menu without it falls back to
      // a no-op setter instead of throwing.
      const menuOpenState = typeof useMenuOpenState === 'function' ? useMenuOpenState() : null;
      const setMenuOpen = typeof menuOpenState?.[1] === 'function' ? menuOpenState[1] : () => {};
      const [state, setState] = useState({ busy: false, failed: false });
      const closeMenu = useCallback(() => {
        try {
          setMenuOpen(false);
        } catch {
          // A menu that cannot be dismissed still performs the action.
        }
      }, [setMenuOpen]);

      if (sessionId.length === 0) return null;
      if (boardOf(ctx) === undefined) return null;

      const add = async () => {
        closeMenu();
        setState({ busy: true, failed: false });
        const title = displayTitle.trim().length > 0 ? displayTitle : tr('card.untitled');
        try {
          await dispatchAction(ctx, 'create-card', {
            sessionId,
            title,
            description: tr('card.description', { id: sessionId }),
            prompt: tr('card.prompt', { title }),
          });
          setState({ busy: false, failed: false });
          // Show the board so the new card is visibly there.
          try {
            service(ctx, 'layout')?.selectPanel?.(BOARD_PANEL);
          } catch {
            // Opening the panel is a convenience; the card already exists.
          }
        } catch (error) {
          console.warn('[task-board-session-link] add failed:', error);
          setState({ busy: false, failed: true });
        }
      };

      const label = state.busy ? tr('menu.busy') : state.failed ? tr('menu.failed') : tr('menu.add');
      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          'data-dsh-session-link': 'menu-entry',
          disabled: state.busy,
          onClick: () => void add(),
          style: {
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '6px 10px',
            border: '0',
            background: 'transparent',
            color: state.failed ? 'var(--dsw-alias-state-error-primary)' : 'inherit',
            font: 'inherit',
            fontSize: '13px',
            textAlign: 'left',
            cursor: state.busy ? 'progress' : 'pointer',
          },
        },
        label,
      );
    }

    /**
     * Card decoration: a badge that jumps straight to the linked Session.
     * @param props - card decoration owner props.
     * @returns the badge, or null when this card links nothing.
     */
    function CardSessionBadge(props) {
      const ctx = props.ctx;
      const link = linkOf(props.task);
      if (link === null) return null;
      const title = link.title.trim().length > 0 ? link.title : tr('card.untitled');
      return h(
        'button',
        {
          type: 'button',
          'data-dsh-session-link': 'card-badge',
          title: `${tr('badge.title')}: ${title}`,
          onClick: event => {
            event.preventDefault();
            event.stopPropagation();
            openSession(ctx, link.sessionId);
          },
          style: {
            ...buttonStyle,
            color: 'var(--dsw-alias-state-business-primary)',
            background: 'var(--dsw-alias-interactive-bg-hover)',
            maxWidth: '100%',
          },
        },
        h(
          'svg',
          { width: 12, height: 12, viewBox: '0 0 16 16', 'aria-hidden': true, style: { display: 'block', flex: 'none' } },
          h('path', {
            d: 'M6.5 9.5 9.5 6.5M7 4.5 8.2 3.3a2.6 2.6 0 0 1 3.7 3.7L10.7 8.2M6.6 8.4 5.4 9.6a2.6 2.6 0 0 0 3.7 3.7l1.2-1.2',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.3,
            strokeLinecap: 'round',
          }),
        ),
        h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, title),
      );
    }

    /**
     * Card detail section: show, open, change, or clear the linked Session.
     * @param props - detail section owner props.
     * @returns the section element.
     */
    function DetailSessionSection(props) {
      const ctx = props.ctx;
      const task = props.task;
      const dispatch = props.dispatch;
      const link = linkOf(task);
      const [picker, setPicker] = useState(false);
      const [query, setQuery] = useState('');
      const [failed, setFailed] = useState(false);
      const rows = useSessionRows(ctx);

      const send = useCallback(
        async (action, payload) => {
          setFailed(false);
          try {
            const accepted = await dispatch({ extensionId: EXTENSION_ID, action, payload });
            if (accepted === false) throw new Error('the task board refused the action');
            return true;
          } catch (error) {
            console.warn('[task-board-session-link] action failed:', error);
            setFailed(true);
            return false;
          }
        },
        [dispatch],
      );

      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (needle.length === 0) return rows.slice(0, 8);
        return rows
          .filter(row => row.title.toLowerCase().includes(needle) || row.sessionId.toLowerCase().includes(needle))
          .slice(0, 8);
      }, [rows, query]);

      const header = h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' } },
        h('span', { style: { fontSize: '12px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)' } }, tr('detail.title')),
      );

      let body;
      if (link === null) {
        body = h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' } }, tr('detail.none')),
          h(
            'button',
            {
              type: 'button',
              'data-dsh-session-link': 'detail-choose',
              onClick: () => setPicker(value => !value),
              style: { ...buttonStyle, alignSelf: 'flex-start', color: 'var(--dsw-alias-state-business-primary)' },
            },
            picker ? tr('detail.cancel') : tr('detail.choose'),
          ),
        );
      } else {
        const linkedTitle = link.title.trim().length > 0 ? link.title : tr('card.untitled');
        body = h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } },
            h(
              'span',
              {
                style: {
                  fontSize: '12px',
                  color: 'var(--dsw-alias-label-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                },
                title: link.sessionId,
              },
              linkedTitle,
            ),
          ),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' } },
            h(
              'button',
              {
                type: 'button',
                'data-dsh-session-link': 'detail-open',
                onClick: () => openSession(ctx, link.sessionId),
                style: { ...buttonStyle, color: 'var(--dsw-alias-state-business-primary)' },
              },
              tr('detail.open'),
            ),
            h(
              'button',
              {
                type: 'button',
                'data-dsh-session-link': 'detail-change',
                onClick: () => setPicker(value => !value),
                style: buttonStyle,
              },
              picker ? tr('detail.cancel') : tr('detail.chooseOther'),
            ),
            h(
              'button',
              {
                type: 'button',
                'data-dsh-session-link': 'detail-unlink',
                onClick: () => void send('unlink', { taskId: task.id }),
                style: { ...buttonStyle, color: 'var(--dsw-alias-label-tertiary)' },
              },
              tr('detail.unlink'),
            ),
          ),
        );
      }

      const chooser = picker
        ? h(
            'div',
            { style: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' } },
            h('input', {
              value: query,
              placeholder: tr('detail.search'),
              'aria-label': tr('detail.search'),
              onChange: event => setQuery(event.target.value),
              style: fieldStyle,
            }),
            filtered.length === 0
              ? h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', padding: '4px 2px' } }, tr('detail.empty'))
              : h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', maxHeight: '200px', overflowY: 'auto' } },
                  ...filtered.map(row =>
                    h(
                      'button',
                      {
                        key: row.sessionId,
                        type: 'button',
                        'data-dsh-session-link': 'detail-row',
                        title: row.sessionId,
                        onClick: () => {
                          void send('link', {
                            taskId: task.id,
                            sessionId: row.sessionId,
                            title: row.title.trim().length > 0 ? row.title : tr('card.untitled'),
                          }).then(ok => {
                            if (ok) setPicker(false);
                          });
                        },
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          width: '100%',
                          padding: '5px 6px',
                          border: '0',
                          borderRadius: 'var(--dsw-radius-sm)',
                          background: 'transparent',
                          color: 'var(--dsw-alias-label-primary)',
                          font: 'inherit',
                          fontSize: '12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                        },
                      },
                      h(
                        'span',
                        { style: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                        row.title.trim().length > 0 ? row.title : tr('card.untitled'),
                      ),
                      row.running
                        ? h('span', { style: { flex: 'none', fontSize: '11px', color: 'var(--dsw-alias-state-success-primary)' } }, tr('detail.running'))
                        : null,
                    ),
                  ),
                ),
          )
        : null;

      return h(
        'div',
        {
          'data-dsh-session-link': 'detail-section',
          style: {
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '0.5px solid var(--dsw-alias-border-l2)',
            display: 'flex',
            flexDirection: 'column',
          },
        },
        header,
        body,
        failed ? h('span', { role: 'status', style: { marginTop: '4px', fontSize: '11px', color: 'var(--dsw-alias-state-error-primary)' } }, tr('detail.failed')) : null,
        chooser,
        h('span', { style: { marginTop: '6px', fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' } }, tr('detail.note')),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const withContext = Component => props => h(Component, { ...props, ctx });

        ctx.effect(() =>
          ctx.slots.inject('sidebar.workspaces.session.menu.item', () =>
            ctx.slots.register(
              { name: 'sidebar.workspaces.session.menu.item', id: 'task-board-session-link', order: 400 },
              withContext(SessionMenuEntry),
            ),
          ),
        );

        ctx.effect(() =>
          ctx.slots.inject('task-board.card.decoration', () =>
            ctx.slots.register(
              { name: 'task-board.card.decoration', id: 'task-board-session-link' },
              withContext(CardSessionBadge),
            ),
          ),
        );

        ctx.effect(() =>
          ctx.slots.inject('task-board.detail.section', () =>
            ctx.slots.register(
              { name: 'task-board.detail.section', id: 'task-board-session-link' },
              withContext(DetailSessionSection),
            ),
          ),
        );
      },
    };
  },
});
