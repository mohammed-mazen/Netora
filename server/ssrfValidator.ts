import dns from "dns";
import { promisify } from "util";
import net from "net";

const lookup = promisify(dns.lookup);

export class SSRFValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFValidationError";
  }
}

/**
 * Validates a given hostname or IP to prevent SSRF against internal/private
 * networks or metadata endpoints.
 * It resolves the hostname and checks the resulting IP addresses.
 */
export async function validateExternalTarget(targetHost: string): Promise<string> {
  const host = targetHost.trim();
  if (!host) throw new SSRFValidationError("Target host is empty");

  let ips: string[] = [];
  if (net.isIP(host)) {
    ips = [host];
  } else {
    try {
      const result = await lookup(host, { all: true });
      if (Array.isArray(result)) {
        ips = result.map((r: any) => r.address);
      } else {
        ips = [(result as any).address];
      }
    } catch (e: any) {
      throw new SSRFValidationError(`DNS resolution failed for ${host}: ${e.message}`);
    }
  }

  if (ips.length === 0) {
    throw new SSRFValidationError(`Could not resolve any IP addresses for ${host}`);
  }

  for (const ip of ips) {
    if (net.isIPv4(ip)) {
      // Reject loopback
      if (ip.startsWith("127.")) throw new SSRFValidationError("Loopback IPs are not allowed");
      // Reject local/private
      if (ip.startsWith("10.") || ip.startsWith("192.168.")) throw new SSRFValidationError("Private network IPs are not allowed");
      if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) throw new SSRFValidationError("Private network IPs are not allowed");
      // Reject metadata endpoints
      if (ip === "169.254.169.254") throw new SSRFValidationError("Metadata endpoints are not allowed");
      // Reject link-local
      if (ip.startsWith("169.254.")) throw new SSRFValidationError("Link-local IPs are not allowed");
      // Reject multicast
      if (ip.startsWith("224.") || ip.startsWith("239.")) throw new SSRFValidationError("Multicast IPs are not allowed");
      // Reject unspecified
      if (ip === "0.0.0.0") throw new SSRFValidationError("Unspecified IP is not allowed");
    } else if (net.isIPv6(ip)) {
      // Reject loopback
      if (ip === "::1") throw new SSRFValidationError("IPv6 loopback is not allowed");
      // Reject unspecified
      if (ip === "::") throw new SSRFValidationError("IPv6 unspecified IP is not allowed");
      // Reject Unique Local Addresses (ULA)
      if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) throw new SSRFValidationError("IPv6 ULA is not allowed");
      // Reject Link-Local
      if (ip.toLowerCase().startsWith("fe80:")) throw new SSRFValidationError("IPv6 link-local is not allowed");
      // Reject multicast
      if (ip.toLowerCase().startsWith("ff")) throw new SSRFValidationError("IPv6 multicast is not allowed");
      // IPv4-mapped IPv6
      if (ip.toLowerCase().startsWith("::ffff:")) {
        const v4Str = ip.split(":").pop();
        if (v4Str) {
           if (v4Str.startsWith("127.") || v4Str.startsWith("10.") || v4Str.startsWith("192.168.") || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(v4Str) || v4Str === "169.254.169.254") {
              throw new SSRFValidationError("Mapped IPv4 private/loopback is not allowed");
           }
        }
      }
    } else {
      throw new SSRFValidationError(`Invalid IP format: ${ip}`);
    }
  }

  return host; // Return original host if valid
}

export function parseRouterEndpoint(address: string, defaultPort = 8729): { hostname: string; port: number } {
  let hostname = address;
  let port = defaultPort;

  // IPv6 literal, e.g. [2001:db8::1]:8729
  if (address.startsWith("[")) {
    const endBracket = address.indexOf("]");
    if (endBracket !== -1) {
      hostname = address.substring(1, endBracket);
      if (address[endBracket + 1] === ":") {
        const portStr = address.substring(endBracket + 2);
        const parsedPort = parseInt(portStr, 10);
        if (!isNaN(parsedPort)) port = parsedPort;
      }
    }
  } else if (address.includes(":")) {
    const parts = address.split(":");
    if (parts.length === 2) {
      hostname = parts[0];
      const parsedPort = parseInt(parts[1], 10);
      if (!isNaN(parsedPort)) port = parsedPort;
    }
  }

  return { hostname, port };
}
