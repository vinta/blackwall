// Only blackwall's own vars, so keys from ~/.blackwall/.env never reach the terminal
export function printEnv(envSources) {
  for (const [label, vars, shell = []] of envSources) {
    console.log(`# ${label}`);
    for (const [key, value] of Object.entries(vars)) console.log(`${key}=${value}`);
    for (const line of shell) console.log(line);
  }

  console.log("# srt adds its proxy, TMPDIR, and git vars at launch");
}
