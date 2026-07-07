import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from "next/constants.js";

/** @type {import('next').NextConfig} */
const baseConfig = {
  images: {
    domains: [],
  },
};

export default function nextConfig(phase) {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      ...baseConfig,
      distDir: ".next-dev",
    };
  }

  if (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER) {
    return {
      ...baseConfig,
      distDir: ".next-prod",
    };
  }

  return baseConfig;
}
