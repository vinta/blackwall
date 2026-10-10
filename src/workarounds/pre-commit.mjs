import { CACHE } from "../config.mjs";

export default {
  why: "pre-commit can't write its default ~/.cache/pre-commit; srt sets http.proxyAuthMethod=basic through GIT_CONFIG_PARAMETERS, which pre-commit strips before cloning hook repos; srt's proxy aborts git's default credential-less CONNECT",

  env() {
    return { PRE_COMMIT_HOME: `${CACHE}/pre-commit`, GIT_HTTP_PROXY_AUTHMETHOD: "basic" };
  },
};
