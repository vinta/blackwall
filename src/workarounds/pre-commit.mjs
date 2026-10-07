export default {
  why: "srt sets http.proxyAuthMethod=basic through GIT_CONFIG_PARAMETERS, which pre-commit strips before cloning hook repos; srt's proxy aborts git's default credential-less CONNECT",

  env() {
    return { GIT_HTTP_PROXY_AUTHMETHOD: "basic" };
  },
};
