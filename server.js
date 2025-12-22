import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();

// ✅ CORS для GitHub Pages + обработка preflight (OPTIONS)
const corsOptions = {
  origin: "https://savka86.github.io",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

app.get("/", (req, res) => {
  res.status(200).send("OK. Use POST /api/generate");
});

async function downloadToBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to download image: HTTP ${r.status}`);
  const contentType = r.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await r.arrayBuffer());
  return { buffer: buf, contentType };
}

app.post("/api/generate", upload.single("photo"), async (req, res) => {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return res.status(500).send("Missing REPLICATE_API_TOKEN");

    const prompt = (req.body.prompt || "").toString().trim();
    const format = (req.body.format || "3:4").toString().trim();

    if (!req.file) return res.status(400).send("No photo uploaded (field: photo)");
    if (!prompt) return res.status(400).send("No prompt (field: prompt)");

    const size = format === "3:4"
      ? { width: 768, height: 1024 }
      : { width: 1024, height: 1024 };

    const finalPrompt =
      prompt +
      "\nСоветская новогодняя открытка 1950–1980-х, мягкий свет, аккуратная композиция, высокое качество.";

    // ✅ Replicate HTTP API (sync): POST /v1/predictions + Prefer: wait
    const resp = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Prefer": "wait=60"
      },
      body: JSON.stringify({
        model: "stability-ai/sdxl",
        input: {
          prompt: finalPrompt,
          width: size.width,
          height: size.height,
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 30
        }
      })
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      if (resp.status === 429) return res.status(429).send(t || "Rate limit from Replicate");
      throw new Error(`Replicate HTTP ${resp.status}: ${t.slice(0, 600)}`);
    }

    const pred = await resp.json();

    if (!pred.output) {
      throw new Error(`Replicate status=${pred.status}. Try again or increase wait time.`);
    }

    const imageUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (!imageUrl || typeof imageUrl !== "string") {
      throw new Error("Replicate returned empty output URL");
    }

    const { buffer, contentType } = await downloadToBuffer(imageUrl);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);

  } catch (e) {
    return res.status(500).send(String(e?.message || e));
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Listening on", port));
