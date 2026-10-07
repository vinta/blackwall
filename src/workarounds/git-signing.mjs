export default {
  why: "gpg can't reach ~/.gnupg under denyRead",

  env() {
    return { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "commit.gpgsign", GIT_CONFIG_VALUE_0: "false" };
  },
};
