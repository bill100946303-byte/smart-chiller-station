function normalizeUrl(baseUrl, path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${p}`;
}

function sanitizeXmlText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\n/g, "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function unescapeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseXmlToTree(text) {
  const input = sanitizeXmlText(text);
  const tokenRegex = /<[^>]+>|[^<]+/g;
  const root = { name: "__root__", children: [], text: "" };
  const stack = [root];
  let token = tokenRegex.exec(input);

  while (token) {
    const raw = token[0];
    const current = stack[stack.length - 1];
    if (raw.startsWith("<!--")) {
      token = tokenRegex.exec(input);
      continue;
    }
    if (raw.startsWith("<?") || raw.startsWith("<!")) {
      token = tokenRegex.exec(input);
      continue;
    }

    if (raw.startsWith("</")) {
      const closeName = raw.slice(2, -1).trim();
      while (stack.length > 1) {
        const node = stack.pop();
        if (node?.name === closeName) {
          break;
        }
      }
      token = tokenRegex.exec(input);
      continue;
    }

    if (raw.startsWith("<")) {
      const selfClosing = raw.endsWith("/>");
      const inside = raw.slice(1, selfClosing ? -2 : -1).trim();
      const name = inside.split(/\s+/)[0];
      const node = { name, children: [], text: "" };
      current.children.push(node);
      if (!selfClosing) {
        stack.push(node);
      }
      token = tokenRegex.exec(input);
      continue;
    }

    const textValue = unescapeXml(raw).trim();
    if (textValue) {
      current.text = current.text ? `${current.text}${textValue}` : textValue;
    }
    token = tokenRegex.exec(input);
  }

  return root.children[0] || null;
}

function xmlTreeToObject(node) {
  if (!node) {
    return null;
  }
  if (!node.children || node.children.length === 0) {
    return node.text || "";
  }

  const grouped = {};
  for (const child of node.children) {
    const value = xmlTreeToObject(child);
    if (Object.prototype.hasOwnProperty.call(grouped, child.name)) {
      if (!Array.isArray(grouped[child.name])) {
        grouped[child.name] = [grouped[child.name]];
      }
      grouped[child.name].push(value);
    } else {
      grouped[child.name] = value;
    }
  }

  return grouped;
}

function parseXmlPayload(text) {
  const tree = parseXmlToTree(text);
  if (!tree) {
    return null;
  }
  const payload = xmlTreeToObject(tree);
  if (tree.name === "SysResult" && payload && typeof payload === "object") {
    return payload;
  }
  return payload;
}

function parsePayloadText(text) {
  if (!text) {
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  if (trimmed.startsWith("<")) {
    const parsedXml = parseXmlPayload(trimmed);
    if (parsedXml !== null) {
      return parsedXml;
    }
  }
  return { raw: trimmed };
}

export async function fetchLegacyJson(baseUrl, path) {
  const response = await requestLegacy(baseUrl, path);
  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    error: response.error,
    payload: response.payload
  };
}

export async function requestLegacy(baseUrl, path, options = {}) {
  const url = normalizeUrl(baseUrl, path);
  let response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers: options.headers,
      body: options.body
    });
  } catch (error) {
    return {
      ok: false,
      status: null,
      url,
      error: `Legacy request error: ${String(error)}`,
      payload: null,
      headers: {
        contentType: null,
        contentDisposition: null
      }
    };
  }

  const text = await response.text();
  const headers = {
    contentType: response.headers.get("content-type"),
    contentDisposition: response.headers.get("content-disposition")
  };

  let payload = null;
  if (text) {
    try {
      payload = parsePayloadText(text);
    } catch (error) {
      return {
        ok: false,
        status: response.status,
        url,
        error: `Invalid JSON from legacy endpoint: ${String(error)}`,
        payload: null,
        headers
      };
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      url,
      error: `Legacy request failed: ${response.status}`,
      payload,
      headers
    };
  }

  return {
    ok: true,
    status: response.status,
    url,
    error: null,
    payload,
    headers
  };
}

export async function fetchLegacyBinary(baseUrl, path) {
  const url = normalizeUrl(baseUrl, path);
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    return {
      ok: false,
      status: null,
      url,
      error: `Legacy request error: ${String(error)}`,
      data: null,
      headers: {}
    };
  }

  const arrayBuffer = await response.arrayBuffer();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      url,
      error: `Legacy request failed: ${response.status}`,
      data: null,
      headers: {
        contentType: response.headers.get("content-type"),
        contentDisposition: response.headers.get("content-disposition")
      }
    };
  }

  return {
    ok: true,
    status: response.status,
    url,
    error: null,
    data: new Uint8Array(arrayBuffer),
    headers: {
      contentType: response.headers.get("content-type"),
      contentDisposition: response.headers.get("content-disposition")
    }
  };
}

export function deepArrayProbe(payload) {
  const visited = new Set();

  function findByPreferred(node, key) {
    if (!node || typeof node !== "object") {
      return null;
    }
    if (visited.has(node)) {
      return null;
    }
    visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findByPreferred(item, key);
        if (found) {
          return found;
        }
      }
      return null;
    }

    if (Array.isArray(node[key])) {
      return node[key];
    }

    for (const value of Object.values(node)) {
      const found = findByPreferred(value, key);
      if (found) {
        return found;
      }
    }
    return null;
  }

  function findAnyArray(node) {
    if (!node || typeof node !== "object") {
      return null;
    }
    if (visited.has(node)) {
      return null;
    }
    visited.add(node);

    if (Array.isArray(node)) {
      return node;
    }
    for (const value of Object.values(node)) {
      const found = findAnyArray(value);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload !== "object") {
    return [];
  }

  const preferred = ["data", "records", "list", "rows", "result"];
  for (const key of preferred) {
    visited.clear();
    const found = findByPreferred(payload, key);
    if (Array.isArray(found)) {
      return found;
    }
  }

  visited.clear();
  const fallback = findAnyArray(payload);
  if (Array.isArray(fallback)) {
    return fallback;
  }

  return [];
}

export function toIsoTimestamp(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) {
      return null;
    }

    const monthDayTime = raw.match(
      /^(\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
    );
    if (monthDayTime) {
      const [, month, day, hour, minute, second] = monthDayTime;
      const year = new Date().getFullYear();
      const normalized = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second || "0").padStart(2, "0")}`;
      const parsed = new Date(normalized);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }

    const sanitized = raw.replace(" ", "T");
    const date = new Date(sanitized);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}
