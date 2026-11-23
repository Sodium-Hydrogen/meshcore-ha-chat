// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { html, render } from 'lit';
import { UnreadController } from '../src/chat/unread-controller';
import '../src/components/conversation-list';
import type { Channel, Contact } from '../src/types';
import { getUnreadAndLastRead } from '../src/api';
import type { HomeAssistant } from '../src/types';


function makeChannel(idx: number, name: string): Channel {
  return {
    channel_idx: idx,
    name,
  } as Channel;
}

function makeContact(prefix: string, name: string): Contact {
  return {
    pubkey_prefix: prefix,
    adv_name: name,
    added_to_node: true,
  } as Contact;
}

describe('ConversationList sorting by most recently messaged', () => {
  it('pushes most recently messaged channels and nodes to the top while preserving filter tabs', async () => {
    const unread = new UnreadController();
    unread.ingestBackendData(
      {
        unread: {
          'binary_sensor.meshcore_aabbcc_111111_messages': 1,
        },
        last_read: {},
        last_message_at: {
          'binary_sensor.meshcore_aabbcc_ch_0_messages': '2026-06-09T10:00:00Z',
          'binary_sensor.meshcore_aabbcc_111111_messages': '2026-06-09T12:00:00Z',
          'binary_sensor.meshcore_aabbcc_ch_1_messages': '2026-06-09T11:00:00Z',
        },
      },
      null,
    );

    const conversations: Array<Contact | Channel> = [
      makeChannel(0, 'Public'),
      makeChannel(1, 'Local'),
      makeContact('222222bbbbbb', 'Unmessaged Node'),
      makeContact('111111aaaaaa', 'Recent Node'),
    ];

    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      html`
        <meshcore-conversation-list
          .conversations=${conversations}
          .unread=${unread}
          .unreadCounts=${unread.counts}
          .nodePrefix=${'aabbcc'}
        ></meshcore-conversation-list>
      `,
      container,
    );

    const listEl = container.querySelector('meshcore-conversation-list') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await listEl.updateComplete;

    const renderedNames = () =>
      Array.from(listEl.shadowRoot!.querySelectorAll('.conversation-name')).map((el) =>
        el.textContent?.trim(),
      );

    // Default "All" tab: channels pinned at top (sorted by last message),
    // followed by nodes (sorted by last message, unmessaged last)
    expect(renderedNames()).toEqual([
      'Local',           // channel, 11:00
      'Public',          // channel, 10:00
      'Recent Node',     // node, 12:00
      'Unmessaged Node', // node, no messages (0)
    ]);

    // Switch to "Channels" tab: still sorted newest message first
    const buttons = Array.from(listEl.shadowRoot!.querySelectorAll<HTMLButtonElement>('.filter-btn'));
    const channelsBtn = buttons.find((b) => b.textContent?.trim() === 'Channels');
    expect(channelsBtn).toBeDefined();
    channelsBtn!.click();
    await listEl.updateComplete;

    expect(renderedNames()).toEqual(['Local', 'Public']);

    // Switch to "DMs" tab: Recent Node appears above Unmessaged Node
    const dmsBtn = buttons.find((b) => b.textContent?.trim() === 'DMs');
    expect(dmsBtn).toBeDefined();
    dmsBtn!.click();
    await listEl.updateComplete;

    expect(renderedNames()).toEqual(['Recent Node', 'Unmessaged Node']);
  });
});

it('passes last_message_at from getUnreadAndLastRead into UnreadController', async () => {
  const mockHass = {
    callWS: async () => ({
      unread: { 'binary_sensor.meshcore_aabbcc_111111_messages': 1 },
      last_read: { 'binary_sensor.meshcore_aabbcc_111111_messages': 'm1' },
      last_message_at: {
        'binary_sensor.meshcore_aabbcc_111111_messages': '2026-06-09T12:00:00Z',
      },
    }),
  } as unknown as HomeAssistant;

  const data = await getUnreadAndLastRead(mockHass, 'entry-1');
  const unread = new UnreadController();
  unread.ingestBackendData(data, null);

  expect(unread.lastActivity('111111aaaaaa', 'aabbcc')).toBe(
    Date.parse('2026-06-09T12:00:00Z'),
  );
});

