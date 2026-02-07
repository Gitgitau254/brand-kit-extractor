import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public"), { maxAge: "0" }));

function normalizeToHttpUrl(input) {
  let s = String(input || "").trim().replace(/\s+/g, "");
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function rgbToHex(r, g, b) {
  const to2 = (x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0");
  return ("#" + to2(r) + to2(g) + to2(b)).toUpperCase();
}

function parseColorToHex(input) {
  if (!input) return "";
  const s = String(input).trim().toLowerCase();
  if (!s || s === "transparent") return "";
  if (s.startsWith("rgba") || s.startsWith("rgb")) {
    const m = s.match(/^rgba?\((.+)\)$/);
    if (!m) return "";
    const parts = m[1].split(",").map(p => p.trim());
    if (parts.length < 3) return "";
    const ch = (v) => {
      if (v.endsWith("%")) return (parseFloat(v) / 100) * 255;
      return parseFloat(v);
    };
    const r = ch(parts[0]); const g = ch(parts[1]); const b = ch(parts[2]);
    if (![r,g,b].every(x => Number.isFinite(x))) return "";
    let a = 1;
    if (parts.length >= 4) {
      a = parseFloat(parts[3]);
      if (!Number.isFinite(a)) a = 1;
    }
    if (a < 0.08) return "";
    return rgbToHex(r, g, b);
  }
  // hex
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let h = hex[0].toUpperCase();
    if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    if (h.length === 9) h = h.slice(0, 7);
    return h;
  }
  return "";
}

function luminance(hex) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function isGrayish(hex) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return Math.max(r, g, b) - Math.min(r, g, b) < 14;
}

function topK(values, k) {
  const map = new Map();
  for (const v of values) {
    if (!v) continue;
    map.set(v, (map.get(v) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,k).map(([v])=>v);
}

function pickMostCommon(values) {
  return topK(values, 1)[0] || "";
}

function pickFirst(values, fn) {
  for (const v of values) if (v && fn(v)) return v;
  return "";
}

function buildKit(extraction) {
  const { meta, samples } = extraction;

  const bgColors = [];
  const textColors = [];
  const borderColors = [];
  const accentColors = [];
  const fontsBody = [];
  const fontsHeading = [];
  const weights = [];
  const sizeBody = [];
  const sizeH1 = [];
  const sizeH2 = [];
  const sizeH3 = [];
  const radius = [];
  const shadows = [];
  const spacing = [];

  for (const s of samples) {
    bgColors.push(parseColorToHex(s.bg));
    textColors.push(parseColorToHex(s.color));
    borderColors.push(parseColorToHex(s.border));
    if (s.kind === "link" || s.kind === "button") accentColors.push(parseColorToHex(s.accent));
    if (s.kind === "body" || s.kind === "text") fontsBody.push(s.fontFamily);
    if (s.kind.startsWith("h")) fontsHeading.push(s.fontFamily);
    weights.push(s.fontWeight);
    if (s.kind === "text") sizeBody.push(s.fontSize);
    if (s.kind === "h1") sizeH1.push(s.fontSize);
    if (s.kind === "h2") sizeH2.push(s.fontSize);
    if (s.kind === "h3") sizeH3.push(s.fontSize);
    radius.push(s.radius);
    if (s.shadow && s.shadow !== "none") shadows.push(s.shadow);
    spacing.push(...s.padding);
  }

  const bgTop = topK(bgColors.filter(Boolean), 12);
  const textTop = topK(textColors.filter(Boolean), 12);
  const borderTop = topK(borderColors.filter(Boolean), 8);

  const bg = pickFirst(bgTop, (h) => luminance(h) > 0.80) || bgTop[0] || "#FFFFFF";
  const surface = pickFirst(bgTop, (h) => h !== bg && luminance(h) > 0.72) || bgTop[1] || bg;

  const text = pickFirst(textTop, (h) => luminance(h) < 0.25) || textTop[0] || "#111827";
  const mutedText = pickFirst(textTop, (h) => h !== text) || textTop[1] || text;

  const border = borderTop[0] || "#E5E7EB";

  const allAccents = topK(
    accentColors.filter(Boolean).filter(h => !isGrayish(h) && h !== bg && h !== surface && h !== text),
    10
  );

  const primary = allAccents[0] || "#2563EB";
  const link = allAccents[1] || primary;
  const accents = allAccents.filter(h => ![primary, link].includes(h)).slice(0, 6);

  const cleanFont = (f) => String(f || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
  const bodyFont = pickMostCommon(fontsBody.map(cleanFont).filter(Boolean));
  const headingFont = pickMostCommon(fontsHeading.map(cleanFont).filter(Boolean)) || bodyFont;

  const normalizeWeight = (w) => {
    const s = String(w || "").trim().toLowerCase();
    if (!s) return "";
    if (s === "normal") return "400";
    if (s === "bold") return "700";
    if (/^\d+$/.test(s)) return s;
    return "";
  };

  const weightList = topK(weights.map(normalizeWeight).filter(Boolean), 5).map((v) => ({ value: v }));

  const pxOnly = (v) => {
    const m = String(v || "").match(/(-?\d+(\.\d+)?)px/);
    return m ? `${Math.round(parseFloat(m[1]))}px` : "";
  };

  const sizeScale = {
    h1: pickMostCommon(sizeH1.map(pxOnly).filter(Boolean)),
    h2: pickMostCommon(sizeH2.map(pxOnly).filter(Boolean)),
    h3: pickMostCommon(sizeH3.map(pxOnly).filter(Boolean)),
    body: pickMostCommon(sizeBody.map(pxOnly).filter(Boolean)),
  };

  const radiusTokens = topK(radius.map(pxOnly).filter(Boolean), 6);
  const shadowTokens = topK(shadows.map(s => String(s).replace(/\s+/g, " ").trim()).filter(Boolean), 4);
  const spacingTokens = topK(
    spacing
      .map(pxOnly)
      .filter(Boolean)
      .filter(v => v !== "0px"),
    10
  );
  const compByKind = {};
  for (const s of samples) {
    if (!["button","input","card"].includes(s.kind)) continue;
    compByKind[s.kind] = s;
  }

  const components = {
    button: compByKind.button ? {
      background: parseColorToHex(compByKind.button.bg),
      text: parseColorToHex(compByKind.button.color),
      radius: pxOnly(compByKind.button.radius),
      shadow: (compByKind.button.shadow && compByKind.button.shadow !== "none") ? String(compByKind.button.shadow).replace(/\s+/g, " ").trim() : ""
    } : null,
    input: compByKind.input ? {
      background: parseColorToHex(compByKind.input.bg),
      text: parseColorToHex(compByKind.input.color),
      border: parseColorToHex(compByKind.input.border),
      radius: pxOnly(compByKind.input.radius)
    } : null,
    card: compByKind.card ? {
      background: parseColorToHex(compByKind.card.bg),
      text: parseColorToHex(compByKind.card.color),
      border: parseColorToHex(compByKind.card.border),
      radius: pxOnly(compByKind.card.radius),
      shadow: (compByKind.card.shadow && compByKind.card.shadow !== "none") ? String(compByKind.card.shadow).replace(/\s+/g, " ").trim() : ""
    } : null
  };


  return {
    meta,
    extractedAt: new Date().toISOString(),
    palette: { background: bg, surface, text, mutedText, border, primary, link, accents },
    typography: { bodyFont, headingFont, sizeScale, weights: weightList },
    ui: { radii: radiusTokens, shadows: shadowTokens, spacing: spacingTokens },
    components
  };
}

app.get("/api/extract", async (req, res) => {
  const url = normalizeToHttpUrl(req.query.url);
  if (!url) return res.status(400).json({ error: "Invalid URL. Enter example.com or a full https:// URL." });

  const started = Date.now();
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    // Avoid heavy media
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "media") return route.abort();
      return route.continue();
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(900);

    const extractionLight = await page.evaluate(() => {
      const isVisible = (el) => {
        const st = window.getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
        const r = el.getBoundingClientRect();
        return r.width > 2 && r.height > 2;
      };

      const pickFirstVisible = (selector) => {
        const els = Array.from(document.querySelectorAll(selector));
        for (const el of els) if (isVisible(el)) return el;
        return null;
      };

      const get = (el) => {
        const st = window.getComputedStyle(el);
        return {
          bg: st.backgroundColor,
          color: st.color,
          border: st.borderTopColor,
          radius: st.borderTopLeftRadius,
          shadow: st.boxShadow,
          fontFamily: st.fontFamily,
          fontSize: st.fontSize,
          fontWeight: st.fontWeight,
          padding: [st.paddingTop, st.paddingRight, st.paddingBottom, st.paddingLeft]
        };
      };

      const body = document.body;
      const h1 = pickFirstVisible("h1") || pickFirstVisible("h2") || body;
      const h2 = pickFirstVisible("h2") || pickFirstVisible("h3") || h1;
      const h3 = pickFirstVisible("h3") || pickFirstVisible("h4") || h2;
      const text = pickFirstVisible("p") || pickFirstVisible("span") || body;
      const link = pickFirstVisible("a[href]") || body;
      const btn = pickFirstVisible("button,[role='button'],input[type='button'],input[type='submit'],a[role='button']") || body;
      const card = pickFirstVisible("[class*='card'],[class*='panel'],[class*='tile'],[class*='modal'],[class*='dialog']") || body;
      const input = pickFirstVisible("input,select,textarea") || body;

      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

      return {
        meta: { title: document.title || "", host: location.host, url: location.href },
        prefersDark,
        samples: [
          { kind: "body", ...get(body), accent: "" },
          { kind: "h1", ...get(h1), accent: "" },
          { kind: "h2", ...get(h2), accent: "" },
          { kind: "h3", ...get(h3), accent: "" },
          { kind: "text", ...get(text), accent: "" },
          { kind: "link", ...get(link), accent: window.getComputedStyle(link).color },
          { kind: "button", ...get(btn), accent: window.getComputedStyle(btn).backgroundColor },
          { kind: "card", ...get(card), accent: "" },
          { kind: "input", ...get(input), accent: "" }
        ]
      };
    });

    const kitLight = buildKit(extractionLight);

    // Dark-mode pass (best-effort)
    let kitDark = null;
    try {
      await page.emulateMedia({ colorScheme: "dark" });
      await page.waitForTimeout(650);
      const extractionDark = await page.evaluate(() => {
        const isVisible = (el) => {
          const st = window.getComputedStyle(el);
          if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
          const r = el.getBoundingClientRect();
          return r.width > 2 && r.height > 2;
        };

        const pickFirstVisible = (selector) => {
          const els = Array.from(document.querySelectorAll(selector));
          for (const el of els) if (isVisible(el)) return el;
          return null;
        };

        const get = (el) => {
          const st = window.getComputedStyle(el);
          return {
            bg: st.backgroundColor,
            color: st.color,
            border: st.borderTopColor,
            radius: st.borderTopLeftRadius,
            shadow: st.boxShadow,
            fontFamily: st.fontFamily,
            fontSize: st.fontSize,
            fontWeight: st.fontWeight,
            padding: [st.paddingTop, st.paddingRight, st.paddingBottom, st.paddingLeft]
          };
        };

        const body = document.body;
        const h1 = pickFirstVisible("h1") || pickFirstVisible("h2") || body;
        const h2 = pickFirstVisible("h2") || pickFirstVisible("h3") || h1;
        const h3 = pickFirstVisible("h3") || pickFirstVisible("h4") || h2;
        const text = pickFirstVisible("p") || pickFirstVisible("span") || body;
        const link = pickFirstVisible("a[href]") || body;
        const btn = pickFirstVisible("button,[role='button'],input[type='button'],input[type='submit'],a[role='button']") || body;
        const card = pickFirstVisible("[class*='card'],[class*='panel'],[class*='tile'],[class*='modal'],[class*='dialog']") || body;
        const input = pickFirstVisible("input,select,textarea") || body;

        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

        return {
          meta: { title: document.title || "", host: location.host, url: location.href },
          prefersDark,
          samples: [
            { kind: "body", ...get(body), accent: "" },
            { kind: "h1", ...get(h1), accent: "" },
            { kind: "h2", ...get(h2), accent: "" },
            { kind: "h3", ...get(h3), accent: "" },
            { kind: "text", ...get(text), accent: "" },
            { kind: "link", ...get(link), accent: window.getComputedStyle(link).color },
            { kind: "button", ...get(btn), accent: window.getComputedStyle(btn).backgroundColor },
            { kind: "card", ...get(card), accent: "" },
            { kind: "input", ...get(input), accent: "" }
          ]
        };
      });
      kitDark = buildKit(extractionDark);
    } catch {
      kitDark = null;
    }

    const darkModeDetected = !!(kitDark && (
      (kitDark.palette?.background && kitDark.palette.background !== kitLight.palette?.background) ||
      (kitDark.palette?.text && kitDark.palette.text !== kitLight.palette?.text) ||
      (kitDark.palette?.primary && kitDark.palette.primary !== kitLight.palette?.primary)
    ));

    res.json({
      ok: true,
      ms: Date.now() - started,
      kit: kitLight,
      variants: {
        light: kitLight,
        dark: kitDark
      },
      darkModeDetected
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  } finally {
    try { if (browser) await browser.close(); } catch {}
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => console.log(`Brand Kit Extractor running on http://localhost:${PORT}`));
