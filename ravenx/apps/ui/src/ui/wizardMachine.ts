import type { Reducer } from "react";

export type WizardState =
  | { name: "WELCOME" }
  | { name: "CONNECT_ENGINE" }
  | { name: "PATH_SELECT" }
  | { name: "CREATE_AGENT" }
  | { name: "IMPORT_AGENTPACK" }
  | { name: "IMPORT_PREVIEW" }
  | { name: "SKIN_AGENT" }
  | { name: "FINISH" }
  | { name: "ERROR"; error: WizardError; returnTo: WizardState };

export type WizardPath = "create" | "import" | "skip";

export type TrustLabel = "verified" | "community" | "local";

export type PermissionProfile = {
  network?: boolean;
  filesystem?: boolean;
  exec?: boolean;
  camera?: boolean;
  [k: string]: any;
};

export type SecurityFinding = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  file: string;
  desc: string;
  evidence?: string;
};

export type SecurityScan = {
  risk: "low" | "medium" | "high" | "critical" | "unknown";
  score: number;
  findings: SecurityFinding[];
};

export type CompatibilityInfo = {
  isLegacy: boolean;
  converted: boolean;
  legacyKind: string | null;
};

export type AgentPackAnalysis = {
  manifest: any;
  contents: { agents: string[]; skills: string[]; tools: string[]; ui: string[] };
  permissions: PermissionProfile;
  trust: TrustLabel;
  reportId?: string;
  compatibility?: CompatibilityInfo;
  security?: SecurityScan;
};

export type WizardContext = {
  chosenPath: WizardPath | null;
  engine: {
    gatewayUrl: string;
    gatewayToken: string;
    reachable?: boolean;
    authOk?: boolean;
    lastCheckedAt?: number;
  };
  create: {
    templateId: "raven" | "support" | "research" | "auditor";
    agentName: string;
    policyPreset: "safe" | "standard" | "power";
    modelPreset: string;
    createdAgentId?: string;
  };
  import: {
    fileName?: string;
    sizeBytes?: number;
    analysis?: AgentPackAnalysis;
    installedAgentIds?: string[];
  };
  skin: {
    agentId?: string;
    useDefaultSkin: boolean;
    autoPalette: boolean;
    themeFromPalette: boolean;
    cropSuggestion: boolean;
    fileName?: string;
    applied?: { avatarAssetId?: string; theme?: any };
  };
};

export type WizardError = { code: string; message: string; details?: any };

export type WizardEvent =
  | { type: "WIZARD_START" }
  | { type: "SELECT_PATH"; path: WizardPath }
  | { type: "BACK" }
  | { type: "ENGINE_CONFIG_UPDATE"; gatewayUrl?: string; gatewayToken?: string }
  | { type: "ENGINE_TEST_REQUEST" }
  | { type: "ENGINE_TEST_SUCCESS"; reachable: boolean; authOk: boolean }
  | { type: "ENGINE_TEST_FAIL"; error: WizardError }
  | { type: "CONTINUE" }
  | { type: "CREATE_CONFIG_UPDATE"; patch: Partial<WizardContext["create"]> }
  | { type: "CREATE_AGENT_SUCCESS"; agentId: string }
  | { type: "CREATE_AGENT_FAIL"; error: WizardError }
  | { type: "IMPORT_FILE_SELECTED"; fileName: string; sizeBytes: number }
  | { type: "IMPORT_ANALYZE_SUCCESS"; analysis: AgentPackAnalysis }
  | { type: "IMPORT_ANALYZE_FAIL"; error: WizardError }
  | { type: "IMPORT_INSTALL_SUCCESS"; agentIds: string[] }
  | { type: "IMPORT_INSTALL_FAIL"; error: WizardError }
  | { type: "SKIN_CONFIG_UPDATE"; patch: Partial<WizardContext["skin"]> }
  | { type: "SKIN_APPLY_SUCCESS"; agentId: string; applied?: WizardContext["skin"]["applied"] }
  | { type: "SKIN_APPLY_FAIL"; error: WizardError }
  | { type: "SKIP_SKIN" }
  | { type: "DONE" }
  | { type: "DISMISS_ERROR" }
  | { type: "BACK_TO_CONNECT" };

export const initialContext = (): WizardContext => ({
  chosenPath: null,
  engine: {
    gatewayUrl: localStorage.getItem("ravenos.gatewayUrl") || "http://localhost:18789",
    gatewayToken: localStorage.getItem("ravenos.gatewayToken") || "",
  },
  create: {
    templateId: "raven",
    agentName: "Raven",
    policyPreset: "safe",
    modelPreset: "default",
  },
  import: {},
  skin: {
    useDefaultSkin: true,
    autoPalette: true,
    themeFromPalette: true,
    cropSuggestion: true,
  },
});

export const initialState: WizardState = { name: "WELCOME" };

export const wizardReducer: Reducer<{ state: WizardState; ctx: WizardContext }, WizardEvent> = (s, e) => {
  const { state, ctx } = s;

  const toError = (error: WizardError, returnTo: WizardState): { state: WizardState; ctx: WizardContext } => ({
    state: { name: "ERROR", error, returnTo },
    ctx,
  });

  switch (e.type) {
    case "WIZARD_START":
      return { state: { name: "WELCOME" }, ctx };

    case "SELECT_PATH":
      return { state: { name: "CONNECT_ENGINE" }, ctx: { ...ctx, chosenPath: e.path } };

    case "ENGINE_CONFIG_UPDATE": {
      const next = {
        ...ctx,
        engine: {
          ...ctx.engine,
          gatewayUrl: e.gatewayUrl ?? ctx.engine.gatewayUrl,
          gatewayToken: e.gatewayToken ?? ctx.engine.gatewayToken,
        },
      };
      // Persist immediately so refresh doesn't lose it
      localStorage.setItem("ravenos.gatewayUrl", next.engine.gatewayUrl);
      localStorage.setItem("ravenos.gatewayToken", next.engine.gatewayToken);
      return { state, ctx: next };
    }

    case "ENGINE_TEST_REQUEST":
      return { state, ctx };

    case "ENGINE_TEST_SUCCESS": {
      const next = {
        ...ctx,
        engine: { ...ctx.engine, reachable: e.reachable, authOk: e.authOk, lastCheckedAt: Date.now() },
      };
      return { state, ctx: next };
    }

    case "ENGINE_TEST_FAIL":
      return toError(e.error, state);

    case "BACK":
      if (state.name === "CONNECT_ENGINE") return { state: { name: "WELCOME" }, ctx: { ...ctx, chosenPath: null } };
      if (state.name === "PATH_SELECT") return { state: { name: "CONNECT_ENGINE" }, ctx };
      if (state.name === "CREATE_AGENT" || state.name === "IMPORT_AGENTPACK") return { state: { name: "PATH_SELECT" }, ctx };
      if (state.name === "IMPORT_PREVIEW") return { state: { name: "IMPORT_AGENTPACK" }, ctx };
      if (state.name === "SKIN_AGENT") return { state: { name: "PATH_SELECT" }, ctx };
      if (state.name === "FINISH") return { state: { name: "PATH_SELECT" }, ctx };
      return { state, ctx };

    case "CONTINUE":
      // From connect -> path select. Allow even if not tested; UI can gate.
      if (state.name === "CONNECT_ENGINE") return { state: { name: "PATH_SELECT" }, ctx };
      // From path select -> branch
      if (state.name === "PATH_SELECT") {
        if (ctx.chosenPath === "create") return { state: { name: "CREATE_AGENT" }, ctx };
        if (ctx.chosenPath === "import") return { state: { name: "IMPORT_AGENTPACK" }, ctx };
        return { state: { name: "FINISH" }, ctx };
      }
      return { state, ctx };

    case "CREATE_CONFIG_UPDATE":
      return { state, ctx: { ...ctx, create: { ...ctx.create, ...e.patch } } };

    case "CREATE_AGENT_SUCCESS":
      return {
        state: { name: "SKIN_AGENT" },
        ctx: { ...ctx, create: { ...ctx.create, createdAgentId: e.agentId }, skin: { ...ctx.skin, agentId: e.agentId } },
      };

    case "CREATE_AGENT_FAIL":
      return toError(e.error, state);

    case "IMPORT_FILE_SELECTED":
      return { state, ctx: { ...ctx, import: { ...ctx.import, fileName: e.fileName, sizeBytes: e.sizeBytes } } };

    case "IMPORT_ANALYZE_SUCCESS":
      return { state: { name: "IMPORT_PREVIEW" }, ctx: { ...ctx, import: { ...ctx.import, analysis: e.analysis } } };

    case "IMPORT_ANALYZE_FAIL":
      return toError(e.error, state);

    case "IMPORT_INSTALL_SUCCESS": {
      const first = e.agentIds[0];
      const nextCtx = { ...ctx, import: { ...ctx.import, installedAgentIds: e.agentIds }, skin: { ...ctx.skin, agentId: first || ctx.skin.agentId } };
      return { state: first ? { name: "SKIN_AGENT" } : { name: "FINISH" }, ctx: nextCtx };
    }

    case "IMPORT_INSTALL_FAIL":
      return toError(e.error, state);

    case "SKIN_CONFIG_UPDATE":
      return { state, ctx: { ...ctx, skin: { ...ctx.skin, ...e.patch } } };

    case "SKIN_APPLY_SUCCESS":
      return { state: { name: "FINISH" }, ctx: { ...ctx, skin: { ...ctx.skin, agentId: e.agentId, applied: e.applied ?? ctx.skin.applied } } };

    case "SKIN_APPLY_FAIL":
      return toError(e.error, state);

    case "SKIP_SKIN":
      return { state: { name: "FINISH" }, ctx };

    case "DONE":
      return { state: { name: "WELCOME" }, ctx: initialContext() };

    case "DISMISS_ERROR":
      if (state.name === "ERROR") return { state: state.returnTo, ctx };
      return { state, ctx };

    case "BACK_TO_CONNECT":
      return { state: { name: "CONNECT_ENGINE" }, ctx };

    default:
      return { state, ctx };
  }
};
