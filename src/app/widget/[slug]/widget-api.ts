// Calls from the widget page to its own endpoints.

export type WidgetPost = (
  path: string,
  body: Record<string, unknown>,
) => Promise<{
  ok: boolean;
  status: number;
  data: {
    error?: string;
    message?: string;
    fieldErrors?: Record<string, string[]>;
  };
}>;

export async function postJson(path: string, body: Record<string, unknown>) {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Awaited<
      ReturnType<WidgetPost>
    >["data"];
    return { ok: response.ok, status: response.status, data };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "You seem to be offline. Try again in a moment." },
    };
  }
}
