import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

const app = express();

// CORS for GitHub Pages
app.use(cors({
  origin: "https://savka86.github.io",
  methods: ["GET", "POST", "OPTIONS"]
}));
app.options("*", cors());

const upload = multer({ storage: multer.memoryStorage() });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send("OK. Use POST /api/generate");
});

app.post("/api/generate", upload.single("photo"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).send("Missing OPENAI_API_KEY");
    }

    const prompt = req.body.prompt;
    if (!prompt) return res.status(400).send("No prompt");
    if (!req.file) return res.status(400).send("No photo");

    const image = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "768x1024",
      image: req.file.buffer
    });

    const base64 = image.data[0].b64_json;
    const buffer = Buffer.from(base64, "base64");

    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Listening on", port));
