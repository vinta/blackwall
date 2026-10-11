import { CACHE } from "../constants/paths.mjs";

export default {
  why: "pre-commit can't write its default ~/.cache/pre-commit; hooks built on go-re2, like betterleaks, read its compile cache; srt sets http.proxyAuthMethod=basic through GIT_CONFIG_PARAMETERS, which pre-commit strips before cloning hook repos; srt's proxy aborts git's default credential-less CONNECT",
  env: {
    PRE_COMMIT_HOME: `${CACHE}/pre-commit`,
    GIT_HTTP_PROXY_AUTHMETHOD: "basic",
  },
  filesystem: {
    // os.UserCacheDir() on macOS and Linux
    allowRead: ["~/Library/Caches/com.github.wasilibs", "~/.cache/com.github.wasilibs"],
  },
};
