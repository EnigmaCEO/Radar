export interface ProviderBrand {
  key: string;
  displayName: string;
  iconSrc: string | null;
  monogram: string;
}

const PROVIDER_BRAND_BY_KEY: Record<string, Omit<ProviderBrand, "key" | "monogram">> = {
  aerodrome: {
    displayName: "Aerodrome Finance",
    iconSrc: "/providers/aerodrome.svg",
  },
  across: {
    displayName: "Across Protocol",
    iconSrc: "/providers/across.svg",
  },
  chainlink: {
    displayName: "Chainlink",
    iconSrc: "/providers/chainlink.png",
  },
  circle: {
    displayName: "Circle CCTP",
    iconSrc: "/providers/circle.svg",
  },
  curve: {
    displayName: "Curve Finance",
    iconSrc: "/providers/curve.ico",
  },
  pyth: {
    displayName: "Pyth Network",
    iconSrc: "/providers/pyth.png",
  },
  redstone: {
    displayName: "RedStone",
    iconSrc: "/providers/redstone.png",
  },
  uniswap: {
    displayName: "Uniswap",
    iconSrc: "/providers/uniswap.png",
  },
  wormhole: {
    displayName: "Wormhole",
    iconSrc: "/providers/wormhole.ico",
  },
};

const PROVIDER_ALIASES: Record<string, string> = {
  aerodrome: "aerodrome",
  aerodome: "aerodrome",
  "aerodrome finance": "aerodrome",
  "across protocol": "across",
  chainlink: "chainlink",
  "chain link": "chainlink",
  circle: "circle",
  cctp: "circle",
  "circle cctp": "circle",
  "circle_cctp": "circle",
  "circle cctp v2": "circle",
  curve: "curve",
  "curve finance": "curve",
  pyth: "pyth",
  "pyth network": "pyth",
  redstone: "redstone",
  "red stone": "redstone",
  "redstone finance": "redstone",
  uniswap: "uniswap",
  "uniswap v2": "uniswap",
  "uniswap v3": "uniswap",
  "uniswap v4": "uniswap",
  wormhole: "wormhole",
};

function normalizeProviderKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function titleCaseProviderName(value: string): string {
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function buildMonogram(displayName: string): string {
  const words = displayName.match(/[A-Za-z0-9]+/g) ?? [];
  if (words.length === 0) return "?";
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
}

export function getProviderBrand(provider: string): ProviderBrand {
  const normalized = normalizeProviderKey(provider);
  const key = PROVIDER_ALIASES[normalized] ?? normalized;
  const known = PROVIDER_BRAND_BY_KEY[key];
  const displayName = known?.displayName ?? titleCaseProviderName(provider);

  return {
    key,
    displayName,
    iconSrc: known?.iconSrc ?? null,
    monogram: buildMonogram(displayName),
  };
}
