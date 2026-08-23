import { invoke } from "@tauri-apps/api/core";

/**
 * Axios-compatible bridge over Tauri IPC.
 *
 * The original app talked HTTP to a FastAPI backend; every component calls
 * `api.get("/system/...")` / `api.post("/system/...", body)` and reads
 * `{ data }` off the resolved promise. This shim preserves that contract
 * while routing everything through Tauri commands (no network involved).
 */

interface BridgeResponse<T = any> {
  data: T;
  status: number;
}

export class BridgeError extends Error {
  response: { status: number; data: Record<string, unknown> };

  constructor(status: number, detail: string) {
    super(detail);
    this.response = {
      status,
      data: { error: detail, detail },
    };
  }
}

function parseUrl(url: string): { path: string; params: URLSearchParams } {
  const [path, query = ""] = url.split("?");
  return { path, params: new URLSearchParams(query) };
}

function q(params: URLSearchParams, key: string): string | undefined {
  const v = params.get(key);
  return v === null || v === "" ? undefined : v;
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    // Rust commands reject with a plain string message -> axios-like error shape
    if (err instanceof BridgeError) throw err;
    const message =
      typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
    throw new BridgeError(400, message);
  }
}

function tokenArg() {
  return localStorage.getItem("token") ?? undefined;
}

async function get<T = any>(url: string): Promise<BridgeResponse<T>> {
  const { path, params } = parseUrl(url);

  switch (path) {
    case "/system/info":
      return { data: await call("system_info"), status: 200 };
    case "/system/packages":
      return {
        data: await call("packages_get", {
          action: q(params, "action"),
          query: q(params, "query"),
        }),
        status: 200,
      };
    case "/system/package-cleaner/analyze":
      return { data: await call("package_cleaner_analyze"), status: 200 };
    case "/system/setup/status":
      return { data: await call("setup_status"), status: 200 };
    case "/system/services":
      return {
        data: await call("services_get", {
          action: q(params, "action"),
          name: q(params, "name"),
        }),
        status: 200,
      };
    case "/system/processes":
      return {
        data: await call("processes_get", {
          sort: q(params, "sort"),
          search: q(params, "search"),
        }),
        status: 200,
      };
    case "/system/users":
      return {
        data: await call("users_get", {
          action: q(params, "action"),
          username: q(params, "username"),
        }),
        status: 200,
      };
    case "/system/firewall":
      return { data: await call("firewall_get"), status: 200 };
    case "/system/files":
      return {
        data: await call("files_list", { path: q(params, "path") }),
        status: 200,
      };
    case "/system/logs":
      return {
        data: await call("logs_get", {
          logType: q(params, "type"),
          lines: q(params, "lines") ? Number(q(params, "lines")) : undefined,
          search: q(params, "search"),
        }),
        status: 200,
      };
    case "/system/docker":
      return {
        data: await call("docker_get", {
          action: q(params, "action"),
          name: q(params, "name"),
        }),
        status: 200,
      };
    case "/system/network":
      return {
        data: await call("network_get", {
          action: q(params, "action"),
          target: q(params, "target"),
        }),
        status: 200,
      };
    case "/system/disk":
      return {
        data: await call("disk_get", {
          action: q(params, "action"),
          path: q(params, "path"),
        }),
        status: 200,
      };
    case "/system/repositories":
      return { data: await call("repositories_get"), status: 200 };
    case "/backups":
      return { data: await call("backups_list"), status: 200 };
    case "/commands": {
      const search = params.get("search") ?? "";
      const category = params.get("category") ?? "";
      return { data: await call("commands_list", { search, category }), status: 200 };
    }
    case "/audit-logs":
      return { data: await call("audit_logs_list"), status: 200 };
    default:
      throw new BridgeError(404, `No handler for GET ${path}`);
  }
}

async function post<T = any>(
  url: string,
  body?: unknown,
): Promise<BridgeResponse<T>> {
  const { path, params } = parseUrl(url);

  // Multipart uploads arrive as FormData (files.tsx)
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    const file = body.get("file");
    if (!(file instanceof File)) {
      throw new BridgeError(400, "FormData must contain a 'file' entry");
    }
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const contentB64 = btoa(binary);
    return {
      data: await call("files_upload", {
        path: q(params, "path"),
        filename: file.name,
        contentB64,
      }),
      status: 200,
    };
  }

  const payload = (body ?? {}) as Record<string, unknown>;

  switch (path) {
    case "/auth/login":
      return {
        data: await call("auth_login", payload),
        status: 200,
      };
    case "/auth/register":
      return {
        data: await call("auth_register", payload),
        status: 200,
      };
    case "/ai":
      return { data: await call("ai_ask", payload), status: 200 };
    case "/system/packages":
      return {
        data: await call("packages_manage", {
          token: tokenArg(),
          action: payload.action,
          packageName: payload.packageName ?? payload.package_name,
        }),
        status: 200,
      };
    case "/system/software-installer":
      return {
        data: await call("software_installer", {
          token: tokenArg(),
          action: payload.action,
          packages: payload.packages,
        }),
        status: 200,
      };
    case "/system/software-installer/check":
      return {
        data: await call("software_installer_check", {
          packages: payload.packages,
        }),
        status: 200,
      };
    case "/system/package-cleaner/clean":
      return {
        data: await call("package_cleaner_clean", {
          token: tokenArg(),
          actions: payload.actions,
        }),
        status: 200,
      };
    case "/system/setup/run":
      return { data: await call("setup_run", payload), status: 200 };
    case "/system/services":
      return {
        data: await call("services_manage", {
          token: tokenArg(),
          action: payload.action,
          serviceName: payload.serviceName ?? payload.service_name,
        }),
        status: 200,
      };
    case "/system/processes":
      return {
        data: await call("processes_manage", {
          token: tokenArg(),
          pid: Number(payload.pid),
          signal: payload.signal as string | undefined,
        }),
        status: 200,
      };
    case "/system/users":
      return {
        data: await call("users_manage", {
          token: tokenArg(),
          action: payload.action,
          username: payload.username,
          password: payload.password as string | undefined,
          group: payload.group as string | undefined,
        }),
        status: 200,
      };
    case "/system/firewall":
      return {
        data: await call("firewall_manage", {
          token: tokenArg(),
          action: payload.action,
          port: payload.port != null ? String(payload.port) : undefined,
          protocol: payload.protocol as string | undefined,
          fromAddr: payload.fromAddr as string | undefined,
        }),
        status: 200,
      };
    case "/system/files":
      return {
        data: await call("files_manage", {
          token: tokenArg(),
          body: payload,
        }),
        status: 200,
      };
    case "/system/files/upload":
      throw new BridgeError(
        500,
        "Uploads must use FormData against /system/files/upload?path=...",
      );
    case "/system/docker":
      return {
        data: await call("docker_manage", {
          token: tokenArg(),
          body: payload,
        }),
        status: 200,
      };
    case "/system/repositories":
      return {
        data: await call("repositories_manage", {
          token: tokenArg(),
          body: payload,
        }),
        status: 200,
      };
    case "/backups":
      return {
        data: await call("backups_manage", {
          token: tokenArg(),
          body: payload,
        }),
        status: 200,
      };
    case "/commands":
      return { data: await call("commands_create", { body: payload }), status: 200 };
    default:
      throw new BridgeError(404, `No handler for POST ${path}`);
  }
}

export const api = {
  get<T = any>(url: string): Promise<BridgeResponse<T>> {
    return get<T>(url);
  },
  post<T = any>(url: string, body?: unknown): Promise<BridgeResponse<T>> {
    return post<T>(url, body);
  },
};

/** Download helper replacing the old window.open("/api/system/files?action=download...") */
export function downloadFile(path: string) {
  return invoke<{ stdout: string }>("files_download", { path });
}
