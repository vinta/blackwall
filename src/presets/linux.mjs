import { fileURLToPath } from "node:url";

export default {
  why: "/usr/local and the 64-bit lib folders, where Linux tools live; srt runs its apply-seccomp helper inside the sandbox, from wherever npm installed srt",
  filesystem: {
    allowRead: ["/lib64", "/usr/lib64", "/usr/local", fileURLToPath(new URL("../vendor", import.meta.resolve("@anthropic-ai/sandbox-runtime")))],
  },
};
