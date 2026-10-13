export default {
  why: "an allowed host, or any host under an allow-all network, can resolve into your LAN; srt leaves private ranges open so intranet hosts can be allow-listed",
  network: {
    // if any domain resolves to IPs in this list, the connection will be blocked
    // the "private-network" preset adds private IPs to this list to prevent the sandbox from reaching your LAN
    // localhost or 127.0.0.1 is blocked by blackwall by default, unless you add them to allowedDomains explicitly
    deniedResolvedAddresses: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "100.64.0.0/10", "fc00::/7"],
  },
};
