import { useState } from 'react';
import { Loader2, Plus, Trash2, Power } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import {
  useAutomations,
  useCreateAutomation,
  useDeleteAutomation,
  useToggleAutomation,
} from '../../hooks/useAutomations';
import { Button } from '../../components/ui';
import {
  AutomationTriggerType,
  AutomationActionType,
  TaskStatus,
} from '@vineroot/shared-types';

const TRIGGER_OPTIONS: AutomationTriggerType[] = [
  AutomationTriggerType.TASK_CREATED,
  AutomationTriggerType.TASK_STATUS_CHANGED,
  AutomationTriggerType.TASK_COMPLETED,
  AutomationTriggerType.TASK_OVERDUE,
  AutomationTriggerType.ASSIGNEE_CHANGED,
  AutomationTriggerType.SECTION_CHANGED,
];

const ACTION_OPTIONS: AutomationActionType[] = [
  AutomationActionType.CHANGE_STATUS,
  AutomationActionType.SET_PRIORITY,
  AutomationActionType.NOTIFY_USER,
  AutomationActionType.POST_WEBHOOK,
  AutomationActionType.SLACK_NOTIFY,
];

export default function AutomationsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const wid = currentWorkspace?.id;
  const { data: automations, isLoading } = useAutomations(wid);
  const { mutate: createAuto, isPending: creating } = useCreateAutomation(wid);
  const { mutate: deleteAuto } = useDeleteAutomation(wid);
  const { mutate: toggleAuto } = useToggleAutomation(wid);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(
    AutomationTriggerType.TASK_COMPLETED,
  );
  const [fromStatus, setFromStatus] = useState('');
  const [toStatus, setToStatus] = useState('');
  const [actionType, setActionType] = useState<AutomationActionType>(
    AutomationActionType.CHANGE_STATUS,
  );
  const [targetStatus, setTargetStatus] = useState<TaskStatus>(TaskStatus.IN_REVIEW);
  const [notifyUserId, setNotifyUserId] = useState('');
  const [postWebhookUrl, setPostWebhookUrl] = useState('');
  const [slackNotifyText, setSlackNotifyText] = useState(
    '*{title}* — task updated. {link}',
  );

  if (!currentWorkspace) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-600">Select a workspace in the sidebar to manage automations.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (actionType === AutomationActionType.POST_WEBHOOK && !postWebhookUrl.trim()) return;
    const triggerConfig: Record<string, unknown> = {};
    if (triggerType === AutomationTriggerType.TASK_STATUS_CHANGED) {
      if (fromStatus) triggerConfig.fromStatus = fromStatus;
      if (toStatus) triggerConfig.toStatus = toStatus;
    }
    let actionConfig: Record<string, unknown> = {};
    if (actionType === AutomationActionType.CHANGE_STATUS) {
      actionConfig = { targetStatus };
    } else if (actionType === AutomationActionType.SET_PRIORITY) {
      actionConfig = { priority: 'HIGH' };
    } else if (actionType === AutomationActionType.NOTIFY_USER && notifyUserId.trim()) {
      actionConfig = {
        userId: notifyUserId.trim(),
        title: 'Automation',
        body: 'A rule ran for a task in your workspace.',
      };
    } else if (actionType === AutomationActionType.POST_WEBHOOK && postWebhookUrl.trim()) {
      actionConfig = { url: postWebhookUrl.trim() };
    } else if (actionType === AutomationActionType.SLACK_NOTIFY) {
      actionConfig = { text: slackNotifyText.trim() || undefined };
    }
    createAuto(
      {
        name: name.trim(),
        triggerType,
        triggerConfig,
        actions: [{ actionType, actionConfig }],
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          setName('');
          setNotifyUserId('');
          setPostWebhookUrl('');
        },
      },
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Automations</h1>
          <p className="text-gray-600 mt-1">
            Rules that react to task events in {currentWorkspace.name}.
          </p>
        </div>
        <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
          New automation
        </Button>
      </div>

      {showCreate && (
        <form
          onSubmit={submitCreate}
          className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4"
        >
          <h2 className="font-semibold text-gray-900">Create automation</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Move to review when completed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">When</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as AutomationTriggerType)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {TRIGGER_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {triggerType === AutomationTriggerType.TASK_STATUS_CHANGED && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From status (optional)
                  </label>
                  <select
                    value={fromStatus}
                    onChange={(e) => setFromStatus(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Any</option>
                    {Object.values(TaskStatus).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To status (optional)
                  </label>
                  <select
                    value={toStatus}
                    onChange={(e) => setToStatus(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Any</option>
                    {Object.values(TaskStatus).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Then do</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as AutomationActionType)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            {actionType === AutomationActionType.CHANGE_STATUS && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as TaskStatus)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {Object.values(TaskStatus).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {actionType === AutomationActionType.NOTIFY_USER && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <input
                  value={notifyUserId}
                  onChange={(e) => setNotifyUserId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder="cuid of user to notify"
                />
              </div>
            )}
            {actionType === AutomationActionType.POST_WEBHOOK && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                <input
                  type="url"
                  value={postWebhookUrl}
                  onChange={(e) => setPostWebhookUrl(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="https://…"
                />
                <p className="text-xs text-gray-500 mt-1">
                  JSON body: <code className="bg-gray-100 px-1 rounded">source</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">task</code>. Or use workspace{' '}
                  <strong>Integrations</strong> for signed outbound webhooks.
                </p>
              </div>
            )}
            {actionType === AutomationActionType.SLACK_NOTIFY && (
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Message template</label>
                <textarea
                  value={slackNotifyText}
                  onChange={(e) => setSlackNotifyText(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-500">
                  Placeholders: <code className="bg-gray-100 px-1 rounded">{'{title}'}</code>,{' '}
                  <code className="bg-gray-100 px-1 rounded">{'{link}'}</code>. Uses workspace Slack URL from{' '}
                  <strong>Integrations</strong> unless you add a per-rule{' '}
                  <code className="bg-gray-100 px-1 rounded">webhookUrl</code> via API.
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              Save
            </Button>
          </div>
        </form>
      )}

      {!automations?.length ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No automations yet. Create one to run actions when tasks change.
        </div>
      ) : (
        <ul className="space-y-3">
          {automations.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg p-4"
            >
              <div>
                <p className="font-medium text-gray-900">{a.name}</p>
                <p className="text-sm text-gray-500">
                  {a.triggerType} · {a.actions?.length ?? 0} action(s) ·{' '}
                  <span className={a.isActive ? 'text-green-600' : 'text-gray-400'}>
                    {a.isActive ? 'Active' : 'Off'}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleAuto(a.id)}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
                  title={a.isActive ? 'Disable' : 'Enable'}
                >
                  <Power className={`w-4 h-4 ${a.isActive ? 'text-green-600' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteAuto(a.id)}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-red-50 text-red-600"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
