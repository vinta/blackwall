import { fileURLToPath } from "node:url";

export default {
  why: "srt runs its apply-seccomp helper inside the sandbox, from wherever npm installed srt",

  grants() {
    if (process.platform !== "linux") return {};
    return { allowRead: [fileURLToPath(new URL("../vendor", import.meta.resolve("@anthropic-ai/sandbox-runtime")))] };
  },
};
