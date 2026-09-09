/**
 * Acesso do MCP a quadros do CRM Builder.
 *
 * As permissões ficam em `crm_boards.settings.mcp = { list, create, edit, move }`.
 * Ausência de valor = negado (padrão fechado).
 */
import { CopilotoError, safeDbError } from "./envelope.ts";
import type { CopilotoContext } from "./types.ts";

export type BoardMcpAction = "list" | "create" | "edit" | "move";

export interface BoardMcpAccess {
  list: boolean;
  create: boolean;
  edit: boolean;
  move: boolean;
}

const DENIED: BoardMcpAccess = { list: false, create: false, edit: false, move: false };

const ACTION_LABEL: Record<BoardMcpAction, string> = {
  list: "listar",
  create: "criar cards",
  edit: "editar cards",
  move: "mover cards",
};

// deno-lint-ignore no-explicit-any
export function parseBoardMcpAccess(settings: any): BoardMcpAccess {
  const mcp = settings && typeof settings === "object" ? settings.mcp : null;
  if (!mcp || typeof mcp !== "object") return DENIED;
  return {
    list: mcp.list === true,
    create: mcp.create === true,
    edit: mcp.edit === true,
    move: mcp.move === true,
  };
}

export async function getBoardMcpAccess(ctx: CopilotoContext, boardId: string): Promise<BoardMcpAccess> {
  if (!boardId) return DENIED;
  const { data, error } = await ctx.supabase
    .from("crm_boards")
    .select("id, name, settings")
    .eq("client_id", ctx.clientId)
    .eq("id", boardId)
    .maybeSingle();
  if (error) throw safeDbError("database", error);
  if (!data) throw new CopilotoError("NOT_FOUND", "Quadro não encontrado neste escritório.");
  return parseBoardMcpAccess(data.settings);
}

export async function assertBoardMcpAccess(
  ctx: CopilotoContext,
  boardId: string,
  action: BoardMcpAction,
): Promise<void> {
  const access = await getBoardMcpAccess(ctx, boardId);
  if (!access[action]) {
    throw new CopilotoError(
      "FORBIDDEN",
      `O MCP não tem permissão para ${ACTION_LABEL[action]} neste quadro. Libere a opção em CRM Builder → Configurações → Permissões → Acesso do MCP.`,
      { details: { board_id: boardId, action, access } },
    );
  }
}

/** IDs dos quadros do escritório com a opção "Listar" liberada para o MCP. */
export async function listMcpAllowedBoardIds(ctx: CopilotoContext): Promise<string[]> {
  const { data, error } = await ctx.supabase
    .from("crm_boards")
    .select("id, settings")
    .eq("client_id", ctx.clientId);
  if (error) throw safeDbError("database", error);
  // deno-lint-ignore no-explicit-any
  return (data || []).filter((b: any) => parseBoardMcpAccess(b.settings).list).map((b: any) => String(b.id));
}
