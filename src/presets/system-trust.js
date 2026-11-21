export default {
  why: "Apple's curl, git, and /usr/bin/python3 can't verify a site whose root certificate is missing from /etc/ssl/cert.pem, because their fallback to the system trust store goes through this Mach service",
  network: {
    allowMachLookup: ["com.apple.TrustEvaluationAgent"],
  },
};
