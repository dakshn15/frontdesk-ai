import { getManagerContext } from "@/features/workspaces/manager-context";
import { handlePreview } from "@/privileged/assistant/chat-api";

export const maxDuration = 60;

/** The dashboard preview chat, for owners and admins. Tools run as a dry run. */
export async function POST(
  request: Request,
  context: RouteContext<"/api/w/[slug]/assistant">,
) {
  const { slug } = await context.params;
  const manager = await getManagerContext(slug);
  if (!manager) {
    return Response.json(
      { error: "You don't have permission to do that." },
      { status: 403 },
    );
  }
  return handlePreview(request, {
    workspaceId: manager.workspace.id,
    userId: manager.claims.sub,
  });
}
