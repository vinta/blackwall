export default {
  why: "srt's built-in .git denies anchor on cwd only",

  grants({ addDirs }) {
    return { denyWrite: addDirs.flatMap((dir) => [`${dir}/.git/hooks`, `${dir}/.git/config`]) };
  },
};
