import git from "./git.mjs";
import github from "./github.mjs";
import linux from "./linux.mjs";
import mac from "./mac.mjs";
import node from "./node.mjs";
import preCommit from "./pre-commit.mjs";
import python from "./python.mjs";
import tmpdir from "./tmpdir.mjs";

// A config picks a preset only by name from this list, never a file by path
export default { git, github, linux, mac, node, "pre-commit": preCommit, python, tmpdir };
