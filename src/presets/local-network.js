export default {
  why: "an allow-all network still reaches this machine by name; srt refuses loopback, unspecified, link-local, multicast, broadcast, cloud metadata and this machine's own addresses on its own, for names at resolve time and for literals through blackwall's callback, so only the names need listing",
  network: {
    deniedHosts: ["localhost", "*.localhost"],
  },
};
