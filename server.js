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

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

app.get("/", (req, res) => {
  res.status(200).send("OK. Use POST /api/generate");
});

app.post("/api/generate", upload.single("photo"), async (req, res) => {
  try {
   if (!process.env.OPENROUTER_API_KEY) {
  return res.status(500).send("Missing OPENROUTER_API_KEY");
}
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

const completion = await client.chat.completions.create({
  model: process.env.OPENROUTER_MODEL || "openrouter/free",
  messages: [
    {
      role: "system",
      content: "Ты помощник для создания красивых промтов для ИИ-открыток."
    },
    {
      role: "user",
      content: prompt
    }
  ]
});

const text = completion.choices?.[0]?.message?.content || "Нет ответа";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
  <rect width="1024" height="1536" fill="#f7efe0"/>
  <rect x="60" y="60" width="904" height="1416" rx="40" fill="#fff8ea" stroke="#b12a2a" stroke-width="12"/>
  <text x="512" y="180" text-anchor="middle" font-size="64" font-family="Arial" font-weight="bold" fill="#b12a2a">
    ИИ-открытка
  </text>
  <text x="512" y="300" text-anchor="middle" font-size="34" font-family="Arial" fill="#333">
    Промт создан бесплатно
  </text>
  <foreignObject x="120" y="380" width="784" height="900">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial; font-size: 34px; line-height: 1.4; color: #222; text-align: center;">
      ${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
    </div>
  </foreignObject>
</svg>
`;

const imageBase64 = Buffer.from(svg, "utf-8").toString("base64");

return res.status(200).json({
  success: true,
  imageUrl: `data:image/svg+xml;base64,${imageBase64}`,
  imageBase64,
  prompt: text
});
  } catch (e) {
    return res.status(500).send(String(e?.message || e));
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Listening on", port));
