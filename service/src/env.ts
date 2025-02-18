import { z } from "zod";

const envSchema = z.object({
  MARQUEE_NODE: z.string(),
  MQTT_URL: z.string(),
  MQTT_USER: z.string(),
  MQTT_PASS: z.string(),

  MASTODON_URL: z.string(),
  MASTODON_ACCESS_TOKEN: z.string(),

  GEMINI_API_KEY: z.string(),
  SYSTEM_INSTRUCTION: z.string(),
});

export default envSchema.parse(process.env);
