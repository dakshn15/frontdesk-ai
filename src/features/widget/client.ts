// Browser-side helpers for the widget page.

export type StoredChat = {
  token: string;
  expiresAt: string;
  conversationId?: string;
};

const key = (slug: string) => `frontdesk-chat:${slug}`;

/** The visitor's session for this tab, kept so the transcript survives a reload. */
export function readStoredChat(
  slug: string,
  now = new Date(),
): StoredChat | null {
  try {
    const raw = sessionStorage.getItem(key(slug));
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredChat;
    if (!value.token || !(new Date(value.expiresAt) > now)) return null;
    return value;
  } catch {
    return null;
  }
}

export function writeStoredChat(slug: string, value: StoredChat | null): void {
  try {
    if (value) sessionStorage.setItem(key(slug), JSON.stringify(value));
    else sessionStorage.removeItem(key(slug));
  } catch {
    // Storage can be blocked; the chat still works for this page view.
  }
}

/** The host of the page showing the widget, as far as the browser says. */
export function parentHost(): string {
  if (window.top === window) return window.location.hostname;
  const source = window.location.ancestorOrigins?.[0] || document.referrer;
  try {
    return new URL(source).hostname;
  } catch {
    return "";
  }
}

/** Black or white, whichever reads better on the brand colour. */
export function textOn(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.4 ? "#111827" : "#ffffff";
}

/** Holds the visitor's session for the chat transport, which reads it when sending. */
export function chatSessionStore(slug: string) {
  let value: StoredChat | null = null;
  return {
    get: () => value,
    /** Replaces the session in memory and in this tab's storage. */
    set(next: StoredChat | null) {
      value = next;
      writeStoredChat(slug, next);
    },
    /** Takes what this tab stored, without writing it back. */
    load() {
      value = readStoredChat(slug);
      return value;
    },
  };
}
