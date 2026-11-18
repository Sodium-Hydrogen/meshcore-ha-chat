// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { html, render } from 'lit';
import '../src/components/message-bubble';
import type { ChatMessage, MessageGroup } from '../src/types';

function makeRoomServerGroup(opts: {
  author?: string | null;
  signature: string;
}): MessageGroup {
  const displayAuthor =
    opts.author || `Unknown (${opts.signature.slice(0, 6)})`;
  const msg: ChatMessage = {
    id: 'rs-msg-1',
    sender: 'Town Square',
    author: opts.author,
    signature: opts.signature,
    text: 'Hello room',
    timestamp: new Date('2026-06-09T12:00:00Z'),
    isOutgoing: false,
    isSystem: false,
    raw: 'Hello room',
    mentions: [],
  };
  return {
    sender: displayAuthor,
    isOutgoing: false,
    isSystem: false,
    messages: [msg],
    startTime: msg.timestamp,
    endTime: msg.timestamp,
  };
}

async function mountBubble(group: MessageGroup) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(
    html`<meshcore-message-bubble .group=${group}></meshcore-message-bubble>`,
    container,
  );
  const bubble = container.querySelector('meshcore-message-bubble') as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await bubble.updateComplete;
  return bubble;
}

describe('message-bubble room server author and signature display', () => {
  it('renders resolved author header, Author metadata row, and replies to the post author when known', async () => {
    const bubble = await mountBubble(
      makeRoomServerGroup({ author: 'Client', signature: 'bbbbbbbb' }),
    );

    // Group sender header shows the resolved post author, not the room server name
    const senderHeader = bubble.shadowRoot!.querySelector('.sender');
    expect(senderHeader?.textContent).toBe('Client');

    // Open the message action dialog
    const bubbleEl = bubble.shadowRoot!.querySelector('.bubble') as HTMLElement;
    bubbleEl.click();
    await bubble.updateComplete;

    const dialog = bubble.shadowRoot!.querySelector('.message-dialog')!;
    expect(dialog.textContent).toContain('Author: Client (bbbbbbbb)');

    // Clicking Reply targets the post author ("Client"), not "Town Square"
    let replyDetail: unknown = null;
    bubble.addEventListener('reply-to-sender', ((e: CustomEvent) => {
      replyDetail = e.detail;
    }) as EventListener);

    const buttons = Array.from(dialog.querySelectorAll('.message-dialog-action'));
    const replyBtn = buttons.find((b) => b.textContent?.includes('Reply')) as HTMLButtonElement | undefined;
    expect(replyBtn).toBeDefined();
    replyBtn!.click();
    expect(replyDetail).toEqual({ mention: '@[Client] ' });
  });

  it('renders Unknown (<prefix>) header, Author metadata row, and hides Reply when author is null', async () => {
    const bubble = await mountBubble(
      makeRoomServerGroup({ author: null, signature: 'deadbeef' }),
    );

    const senderHeader = bubble.shadowRoot!.querySelector('.sender');
    expect(senderHeader?.textContent).toBe('Unknown (deadbe)');

    // Open the message action dialog
    const bubbleEl = bubble.shadowRoot!.querySelector('.bubble') as HTMLElement;
    bubbleEl.click();
    await bubble.updateComplete;

    const dialog = bubble.shadowRoot!.querySelector('.message-dialog')!;
    expect(dialog.textContent).toContain('Author: Unknown (deadbe) (deadbeef)');

    // Reply action should not be rendered when the post author is unknown
    const buttons = Array.from(dialog.querySelectorAll('.message-dialog-action'));
    const replyBtn = buttons.find((b) => b.textContent?.includes('Reply'));
    expect(replyBtn).toBeUndefined();
  });
});
