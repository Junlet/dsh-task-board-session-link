/**
 * dsh-task-board-session-link — Host half.
 *
 * The task board (`@linxin666/dsh-client-ui-task-board`) publishes a provider
 * extension contract on the `taskBoard` service. This plugin registers one
 * provider extension that stores a Session reference in a card's own
 * `integrations` payload and creates a card for a Session on request. The
 * board owns the ledger, the columns and every run gate; this plugin never
 * touches either, it only writes the one field the board reserves for it.
 *
 * Degradation: a deployment without the board (or with the board switched off)
 * simply never resolves `taskBoard`, so nothing is registered and nothing
 * fails.
 */

/** Plugin row name; the Client module uses the package name instead. */
export const name = 'dsh-task-board-session-link';

/** Stable extension id; also the key of this provider's payload on a card. */
const EXTENSION_ID = 'session-link';

/** Contract version this extension was built against. */
const API_VERSION = 1;

/** Longest Session title this plugin stores on a card. */
const MAX_TITLE = 200;

/**
 * Normalize one untrusted string field.
 * @param value - value from a request payload.
 * @returns the trimmed string, or an empty string.
 */
function textOf(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Read one opaque provider payload out of a dispatched action.
 * @param request - the dispatched extension action.
 * @returns a plain object, or an empty object.
 */
function payloadOf(request) {
  const payload = request?.payload;
  return payload !== null && typeof payload === 'object' ? payload : {};
}

/**
 * Build the card a Session row becomes.
 * @param payload - the dispatched create payload.
 * @returns a task draft plus the integration payload to store.
 */
function draftFromSession(payload) {
  const sessionId = textOf(payload.sessionId);
  if (sessionId.length === 0) throw new Error('session-link: sessionId is required');
  const title = textOf(payload.title).slice(0, MAX_TITLE) || 'Session';
  const description = textOf(payload.description) || `Linked Session: ${sessionId}`;
  const prompt = textOf(payload.prompt) || `Continue the session "${title}" (${sessionId}).`;
  return {
    draft: { title, description, prompt, status: 'todo' },
    integration: { sessionId, title, linkedAt: Date.now() },
  };
}

/**
 * Handle one action the board routes back to this extension.
 * @param face - host capability face while the extension is started, else undefined.
 * @param request - dispatched action request.
 * @returns a small result object for the calling browser half.
 */
function handleAction(face, request) {
  if (face === undefined) throw new Error('session-link: the task board is not running this extension');
  const payload = payloadOf(request);
  const action = textOf(request?.action);

  if (action === 'create-card') {
    const { draft, integration } = draftFromSession(payload);
    const task = face.tasks.create(draft, { payload: integration });
    return { ok: true, taskId: task?.id ?? '', sessionId: integration.sessionId, title: integration.title };
  }

  if (action === 'link') {
    const taskId = textOf(payload.taskId);
    const sessionId = textOf(payload.sessionId);
    if (taskId.length === 0) throw new Error('session-link: taskId is required');
    if (sessionId.length === 0) throw new Error('session-link: sessionId is required');
    face.integration.write(taskId, {
      sessionId,
      title: textOf(payload.title).slice(0, MAX_TITLE),
      linkedAt: Date.now(),
    });
    return { ok: true, taskId, sessionId };
  }

  if (action === 'unlink') {
    const taskId = textOf(payload.taskId);
    if (taskId.length === 0) throw new Error('session-link: taskId is required');
    // null clears the stored reference: the payload is JSON, so `undefined`
    // cannot travel, and the board stores the value opaquely either way.
    face.integration.write(taskId, { sessionId: null, title: null, linkedAt: null });
    return { ok: true, taskId };
  }

  throw new Error(`session-link: unknown action "${action}"`);
}

/**
 * Activate the Host half.
 * @param ctx - Host context.
 */
export function apply(ctx) {
  // The board publishes the service only while it is mounted and switched on;
  // `inject` keeps this plugin dormant otherwise instead of throwing at load.
  ctx.inject(['taskBoard'], child => {
    let face;
    const extension = {
      id: EXTENSION_ID,
      apiVersion: API_VERSION,
      start(host) {
        face = host;
      },
      stop() {
        face = undefined;
      },
      handleAction(request) {
        return handleAction(face, request);
      },
    };
    child.effect(() => child.taskBoard.registerExtension(extension));
  });
}
