/**
 * NetCalc — client-side IPv4 subnet math.
 *
 * An IPv4 address is a 32-bit integer. A CIDR prefix of length P means the
 * first P bits identify the network and the remaining 32-P bits identify hosts.
 * JavaScript bitwise operators are signed 32-bit, so every mask and address
 * is forced back to an unsigned value with >>> 0.
 */

const IP_ERROR = "Enter an IPv4 address as four numbers from 0 to 255, separated by dots.";
const CIDR_ERROR = "Enter a CIDR prefix from 0 to 32.";

/** Return four octets, or null when the text is not a dotted IPv4 address. */
function parseIPv4(value) {
  const parts = String(value).trim().split(".");
  if (parts.length !== 4) return null;

  const octets = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    octets.push(octet);
  }
  return octets;
}

/** Return a prefix 0-32, or null. */
function parseCidr(value) {
  const text = String(value).trim();
  if (!/^\d{1,2}$/.test(text)) return null;
  const prefix = Number(text);
  if (prefix > 32) return null;
  return prefix;
}

function ipToInt(octets) {
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

function intToIp(value) {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255
  ].join(".");
}

/**
 * Build the subnet mask. A shift of 32 is a no-op in JavaScript (shifts are
 * masked to 5 bits), so prefix 0 is handled on its own.
 */
function prefixToMask(prefix) {
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/**
 * Calculate subnet fields for a valid address and prefix.
 *
 * network   = address AND mask          (host bits cleared)
 * broadcast = network OR wildcard       (host bits set)
 * total     = 2^(32-prefix)
 *
 * For /0 through /30 the first and last addresses are reserved, so usable
 * hosts are total - 2. /31 and /32 are special and handled below.
 */
function calculateSubnet(octets, prefix) {
  const address = ipToInt(octets);
  const mask = prefixToMask(prefix);
  const network = (address & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);

  let first;
  let last;
  let usable;
  let note = "";

  if (prefix === 32) {
    // A /32 is a host route: one address, and it is usable.
    first = network;
    last = network;
    usable = 1;
    note = "A /32 prefix is a single host route. The address is its own network, broadcast, and only usable host.";
  } else if (prefix === 31) {
    // RFC 3021: point-to-point links use both addresses. Neither is reserved.
    first = network;
    last = broadcast;
    usable = 2;
    note = "A /31 prefix follows RFC 3021 for point-to-point links. Both addresses are usable hosts, so nothing is reserved for network or broadcast.";
  } else {
    first = (network + 1) >>> 0;
    last = (broadcast - 1) >>> 0;
    usable = total - 2;
  }

  return {
    mask: intToIp(mask),
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    first: intToIp(first),
    last: intToIp(last),
    total,
    usable,
    note
  };
}

function formatCount(value) {
  return value.toLocaleString("en-US");
}

function showError(message) {
  const error = document.querySelector("#error");
  error.textContent = message;
  error.hidden = false;
  document.querySelector("#results").hidden = true;
}

function showResult(ip, prefix, result) {
  document.querySelector("#error").hidden = true;
  document.querySelector("#result-cidr").textContent = `${ip} /${prefix}`;
  document.querySelector("#mask").textContent = result.mask;
  document.querySelector("#network").textContent = result.network;
  document.querySelector("#broadcast").textContent = result.broadcast;
  document.querySelector("#first").textContent = result.first;
  document.querySelector("#last").textContent = result.last;
  document.querySelector("#total").textContent = formatCount(result.total);
  document.querySelector("#usable").textContent = formatCount(result.usable);

  const note = document.querySelector("#note");
  note.hidden = result.note === "";
  note.textContent = result.note;
  document.querySelector("#results").hidden = false;
}

function calculateFromForm() {
  const ipInput = document.querySelector("#ip");
  const cidrInput = document.querySelector("#cidr");
  const octets = parseIPv4(ipInput.value);
  const prefix = parseCidr(cidrInput.value);
  const problems = [];

  if (!octets) problems.push(IP_ERROR);
  if (prefix === null) problems.push(CIDR_ERROR);
  if (problems.length) {
    showError(problems.join(" "));
    return;
  }

  showResult(octets.join("."), prefix, calculateSubnet(octets, prefix));
}

const form = document.querySelector("#calc-form");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateFromForm();
});

document.querySelector(".example-list").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  document.querySelector("#ip").value = button.dataset.ip;
  document.querySelector("#cidr").value = button.dataset.cidr;
  calculateFromForm();
});
