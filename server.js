import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// Disable caching for HTML/CSS/JS during early launch (prevents "can't see changes" issues)
app.use((req, res, next) => {
  const p = (req.path || "").toLowerCase();
  const isHtmlRoute =
    p === "/" ||
    p.endsWith(".html") ||
    p === "/results" ||
    p === "/results.html" ||
    p === "/404" ||
    p === "/404.html";
  const isAsset = /\.(css|js|json|map|webmanifest|xml|txt)$/.test(p);
  if (isHtmlRoute || isAsset) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
  }
  next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
