import github from "./github.mjs";
import linux from "./linux.mjs";
import mac from "./mac.mjs";
import node from "./node.mjs";
import python from "./python.mjs";

// A config picks a preset only by name from this list, never a file by path
export default { github, linux, mac, node, python };
