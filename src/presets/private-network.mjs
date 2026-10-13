export default {
  why: "an allowed host, or any host under an allow-all network, can resolve into your LAN; srt leaves private ranges open so intranet hosts can be allow-listed",
  network: {
    // a name that resolves into these ranges is refused; localhost and loopback are the local-network preset's job
    deniedHosts: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "100.64.0.0/10", "fc00::/7"],
  },
};
