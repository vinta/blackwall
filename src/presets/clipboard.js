export default {
  why: "claude reads a copied image in-process through the pasteboard service; its osascript fallback needs Apple Events, which blackwall never grants. The service reads and writes, so every sandboxed command can read what you copy and replace what you paste next",
  network: {
    allowMachLookup: ["com.apple.pasteboard.1"],
  },
};
