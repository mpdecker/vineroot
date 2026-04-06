import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Trash2, Webhook, Copy, Check } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAuthStore } from '../../stores/auth.store';
import { useUpdateWorkspace, useWorkspaces } from '../../hooks/useWorkspaces';
import {
  useOutboundWebhooks,
  useCreateOutboundWebhook,
  useDeleteOutboundWebhook,
} from '../../hooks/useOutboundWebhooks';
import { Button } from '../../components/ui';
import { OUTBOUND_WEBHOOK_TRIGGER_TYPES, AutomationTriggerType } from '@vineroot/shared-types';

function isWorkspaceAdmin(
  userId: string | undefined,
  members: { userId: string; role: string }[] | undefined,
): boolean {
  if (!userId || !members?.length) return false;
  const m = members.find((x) => x.userId === userId);
  return m?.role === 'OWNER' || m?.role === 'ADMIN';
}

export default function IntegrationsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const { data: workspaces } = useWorkspaces();
  const user = useAuthStore((s) => s.user);
  const wid = currentWorkspace?.id;
  const workspace =
    workspaces?.find((w) => w.id === currentWorkspace?.id) ?? currentWorkspace ?? null;
  const admin = useMemo(
    () => isWorkspaceAdmin(user?.id, workspace?.members),
    [user?.id, workspace?.members],
  );

  const { data: webhooks, isLoading, error } = useOutboundWebhooks(wid);
  const { mutate: saveSlack, isPending: savingSlack } = useUpdateWorkspace();
  const { mutate: createHook, isPending: creating } = useCreateOutboundWebhook(wid);
  const { mutate: deleteHook } = useDeleteOutboundWebhook(wid);

  const [slackUrl, setSlackUrl] = useState('');
  const [hookName, setHookName] = useState('');
  const [hookTargetUrl, setHookTargetUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<AutomationTriggerType[]>([]);
  const [lastSigningSecret, setLastSigningSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!workspace) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <p className="text-gray-600">Select a workspace in the sidebar.</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600">
          Only workspace owners and admins can configure webhooks and Slack for{' '}
          <span className="font-medium">{workspace.name}</span>.
        </p>
        <p className="text-sm text-gray-500">
          <Link to="/automations" className="text-brand-600 hover:underline">
            Automations
          </Link>{' '}
          are available to all members.
        </p>
      </div>
    );
  }

  const toggleEvent = (t: AutomationTriggerType) => {
    setSelectedEvents((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const submitSlack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wid) return;
    saveSlack({
      workspaceId: wid,
      slackIncomingWebhookUrl: slackUrl.trim() || null,
    });
    setSlackUrl('');
  };

  const clearSlack = () => {
    if (!wid) return;
    saveSlack({ workspaceId: wid, slackIncomingWebhookUrl: null });
  };

  const submitWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wid || !hookName.trim() || !hookTargetUrl.trim()) return;
    createHook(
      {
        name: hookName.trim(),
        url: hookTargetUrl.trim(),
        eventTypes: selectedEvents.length ? selectedEvents : undefined,
      },
      {
        onSuccess: (res) => {
          setLastSigningSecret(res.signingSecret);
          setHookName('');
          setHookTargetUrl('');
          setSelectedEvents([]);
        },
      },
    );
  };

  const errMsg = error && (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600 mt-1">
          Connect {workspace.name} to Slack and external systems. Pair with{' '}
          <Link to="/automations" className="text-brand-600 hover:underline">
            Automations
          </Link>{' '}
          for rule-driven <code className="text-sm bg-gray-100 px-1 rounded">POST_WEBHOOK</code> and{' '}
          <code className="text-sm bg-gray-100 px-1 rounded">SLACK_NOTIFY</code> actions.
        </p>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span className="text-[#4A154B] font-bold text-sm">Slack</span>
          <span className="text-gray-400 font-normal text-sm">(optional)</span>
        </h2>
        <p className="text-sm text-gray-600">
          Paste an{' '}
          <a
            href="https://api.slack.com/messaging/webhooks"
            className="text-brand-600 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Incoming Webhook
          </a>{' '}
          URL. The URL is stored server-side and never shown again. Use{' '}
          <strong>SLACK_NOTIFY</strong> automations to post to this channel, or pass a per-rule{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">webhookUrl</code> override.
        </p>
        <p className="text-sm">
          Status:{' '}
          {workspace.slackIncomingWebhookConfigured ? (
            <span className="text-green-600 font-medium">Connected</span>
          ) : (
            <span className="text-gray-500">Not configured</span>
          )}
        </p>
        <form onSubmit={submitSlack} className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">New webhook URL</label>
            <input
              type="url"
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" disabled={savingSlack}>
            {savingSlack ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={clearSlack} disabled={savingSlack}>
            Clear
          </Button>
        </form>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Webhook className="w-5 h-5 text-gray-700" />
          Outbound webhooks
        </h2>
        <p className="text-sm text-gray-600">
          Vineroot sends signed JSON <code className="text-xs bg-gray-100 px-1 rounded">POST</code> requests to
          your URL. Verify header <code className="text-xs bg-gray-100 px-1 rounded">X-Vineroot-Signature</code>{' '}
          as <code className="text-xs bg-gray-100 px-1 rounded">sha256=&lt;hex HMAC-SHA256 of raw body&gt;</code>{' '}
          using your signing secret. Payload shape:{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">{`{ event, occurredAt, task }`}</code>.
        </p>

        {lastSigningSecret && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm space-y-2">
            <p className="font-medium text-amber-900">Signing secret (copy now — shown once)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all text-xs bg-white border border-amber-100 rounded px-2 py-1">
                {lastSigningSecret}
              </code>
              <button
                type="button"
                className="p-2 rounded-lg border border-amber-200 hover:bg-amber-100"
                onClick={async () => {
                  await navigator.clipboard.writeText(lastSigningSecret);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                title="Copy"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <Button type="button" variant="secondary" onClick={() => setLastSigningSecret(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {errMsg && (
          <p className="text-sm text-red-600">
            {String(errMsg)} — check that you are an admin and the API is running.
          </p>
        )}

        <form onSubmit={submitWebhook} className="space-y-4 border border-gray-100 rounded-lg p-4">
          <h3 className="font-medium text-gray-800">Add endpoint</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input
                value={hookName}
                onChange={(e) => setHookName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Zapier / internal service"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Target URL</label>
              <input
                type="url"
                value={hookTargetUrl}
                onChange={(e) => setHookTargetUrl(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="https://example.com/vineroot-hook"
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">
              Events (leave unchecked for all)
            </p>
            <div className="flex flex-wrap gap-2">
              {OUTBOUND_WEBHOOK_TRIGGER_TYPES.map((t) => (
                <label
                  key={t}
                  className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border cursor-pointer ${
                    selectedEvents.includes(t)
                      ? 'border-brand-500 bg-brand-50 text-brand-800'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selectedEvents.includes(t)}
                    onChange={() => toggleEvent(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create webhook'}
          </Button>
        </form>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : !webhooks?.length ? (
          <p className="text-sm text-gray-500 py-4">No outbound webhooks yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {webhooks.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-gray-900">{w.name}</p>
                  <p className="text-xs text-gray-500 break-all">{w.url}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {w.eventTypes?.length
                      ? w.eventTypes.join(', ')
                      : 'All events'}
                    {' · '}
                    {w.isActive ? 'Active' : 'Off'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteHook(w.id)}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-red-50 text-red-600"
                  aria-label="Delete webhook"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
