import express from "express";
import cors from "cors";
import multer from "multer";
import Replicate from "replicate";

const app = express();

app.use(
  cors({
    origin: ["https://savka86.github.io"],
    methods: ["GET", "POST", "OPTIONS"],
  })
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

app.get("/", (req, res) => {
  res.send("OK. Use POST /api/generate");
});

async function downloadToBuffer(url) {
  const r = await fetch(url);
  const contentType = r.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await r.arrayBuffer());
  return { buffer: buf, contentType };
}

app.post("/api/generate", upload.single("photo"), async (req, res) => {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return res.status(500).send("Missing REPLICATE_API_TOKEN");
    }

    const prompt = (req.body.prompt || "").trim();
    const format = (req.body.format || "3:4");

    if (!req.file) return res.status(400).send("No photo uploaded");
    if (!prompt) return res.status(400).send("No prompt");

    const size = format === "3:4"
      ? { width: 768, height: 1024 }
      : { width: 1024, height: 1024 };

    const finalPrompt = prompt +
      "\nСоветская новогодняя открытка 1950–1980-х, мягкий свет, высокое качество.";

    const output = await replicate.run("stability-ai/sdxl", {
      input: {
        prompt: finalPrompt,
        width: size.width,
        height: size.height,
        num_outputs: 1,
        guidance_scale: 7.5,
        num_inference_steps: 30
      }
    });

    const imageUrl = Array.isArray(output) ? output[0] : output;
    const { buffer, contentType } = await downloadToBuffer(imageUrl);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Listening on", port));
