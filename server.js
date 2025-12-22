import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI, { toFile } from "openai";

const app = express();

// ✅ CORS for GitHub Pages
const corsOptions = {
  origin: "https://savka86.github.io",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get("/", (req, res) => {
  res.status(200).send("OK. Use POST /api/generate");
});

app.post("/api/generate", upload.single("photo"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).send("Missing OPENAI_API_KEY");

    const prompt = (req.body.prompt || "").toString().trim();
    if (!prompt) return res.status(400).send("No prompt (field: prompt)");
    if (!req.file) return res.status(400).send("No photo uploaded (field: photo)");

    // ⚠️ GPT Image models support these sizes: 1024x1024, 1536x1024, 1024x1536, or auto.
    // For postcard portrait, use 1024x1536.
    const size = "1024x1536";

    // IMPORTANT:
    // Image-to-image in OpenAI Images API uses the *edits* endpoint, not generations.
    const imageFile = await toFile(
      req.file.buffer,
      req.file.originalname || "photo.png",
      { type: req.file.mimetype || "image/png" }
    );

    const rsp = await client.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt,
      size,
      // Helps preserve facial features from the input image (supported for gpt-image-1)
      input_fidelity: "high",
      // Optional:
      // quality: "high",
      // output_format: "png",
    });

    const b64 = rsp.data?.[0]?.b64_json;
    if (!b64) return res.status(500).send("No image returned from OpenAI");

    const buffer = Buffer.from(b64, "base64");
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch (e) {
    return res.status(500).send(String(e?.message || e));
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Listening on", port));
