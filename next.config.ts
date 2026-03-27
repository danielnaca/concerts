import type { NextConfig } from "next";
import { execSync } from "child_process";

let commitInfo = "dev";
try {
  const hash = execSync("git log -1 --format=%h").toString().trim();
  const msg = execSync("git log -1 --format=%s").toString().trim().slice(0, 40);
  const time = execSync("git log -1 --format=%cd --date=format:'%H:%M'").toString().trim();
  commitInfo = `${hash} · ${msg} · ${time}`;
} catch {}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_INFO: commitInfo,
  },
};

export default nextConfig;
