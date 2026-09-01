export type MonitorAction = "reboot" | "shutdown";

export type MonitorRouterCommand = {
  path: string;
  method: "POST";
};

export type MonitorCapability = {
  rebootable: boolean;
  shutdownable: boolean;
};

export type MonitorActionResult = { ok: boolean; error?: string };

const routerCommands: Record<MonitorAction, MonitorRouterCommand> = {
  reboot: { path: "/system/reboot", method: "POST" },
  shutdown: { path: "/system/shutdown", method: "POST" },
};

export function buildRouterCommand(action: MonitorAction): MonitorRouterCommand {
  const command = routerCommands[action];
  if (!command) throw new Error(`إجراء مراقبة غير معروف: ${action}`);
  return command;
}

export function resolveMonitorActionCapability(action: MonitorAction, capability: MonitorCapability): { ok: boolean; error?: string } {
  if (action === "reboot" && !capability.rebootable) {
    return { ok: false, error: "إعادة التشغيل عن بُعد معطّلة في إعدادات المراقبة لهذه المؤسسة" };
  }
  if (action === "shutdown" && !capability.shutdownable) {
    return { ok: false, error: "الإيقاف عن بُعد معطّل في إعدادات المراقبة لهذه المؤسسة" };
  }
  return { ok: true };
}

export function summarizeMonitorActionResult(result: MonitorActionResult): { status: "sent" | "failed"; errorMessage: string | null } {
  return result.ok ? { status: "sent", errorMessage: null } : { status: "failed", errorMessage: result.error ?? "فشل تنفيذ الإجراء على الراوتر" };
}
