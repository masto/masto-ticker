// Display home timeline on the marquee

import { Mutex } from "async-mutex";
import colorsys from "colorsys";
import "dotenv/config";
import { shuffle } from "fast-shuffle";
import mqtt from "mqtt";
import unidecode from "unidecode";
import env from "./env";
import mastodon, { MinimizedTimeline } from "./mastodon";
import makeSummarizer from "./summarizer";

import { installIntoGlobal } from "iterator-helpers-polyfill";
installIntoGlobal();

// Set up Mastodon client
const masto = mastodon.createClient({
  url: env.MASTODON_URL,
  accessToken: env.MASTODON_ACCESS_TOKEN,
});

// Set up GenAI
const summarize = makeSummarizer({
  api_key: env.GEMINI_API_KEY,
  system_instruction: env.SYSTEM_INSTRUCTION,
});

const baseTopic = `marquee/${env.MARQUEE_NODE}`;
const readyTopic = `${baseTopic}/ready`;
const textTopic = `${baseTopic}/text`;
const checkpointTopic = `ticker/${env.MARQUEE_NODE}/checkpoint`;

function random_hue(): number {
  return Math.floor(Math.random() * 360);
}

function hue_code(hue: number): string {
  return `{${colorsys.hsvToHex(hue, 100, 100)}}`;
}

type CheckpointCallback = (checkpoint: {
  timeline: MinimizedTimeline;
  summary: string;
  lastCacheTime: number;
}) => void;

function getTickerTextWithCache(
  cacheSeconds: number,
): (options?: { checkpointCallback?: CheckpointCallback }) => Promise<string> {
  const cache = {
    lastCacheTime: 0,
    text: "",
  };
  const cacheMutex = new Mutex();
  return async function getTickerText(options?: {
    checkpointCallback?: CheckpointCallback;
  }): Promise<string> {
    return cacheMutex.runExclusive(async () => {
      // Don't make a request if we've already done it recently
      const age = (Date.now() - cache.lastCacheTime) / 1000;
      if (age < cacheSeconds) {
        console.log(`Returning from cache for ${cacheSeconds - age} seconds`);
        return cache.text;
      }

      const hue = random_hue();
      const mainColor = hue_code(hue);
      const usernameColor = hue_code(colorsys.rotateHue(hue, 120));
      const boldColor = hue_code(colorsys.rotateHue(hue, 240));

      // Get the home timeline and shuffle the order (gemini is bad at following
      // instructions to pick random items).
      const timeline = shuffle(await masto.getMinimizedHomeTimeline());

      console.log(JSON.stringify(timeline, null, 2));

      // Pass it through Gemini to summarize
      const summary = await summarize(timeline);

      // Clean up the text by forcing it to ASCII
      let text = unidecode(summary.response.text());
      // Clean up extra whitespace
      text = text.replace(/\s+/g, " ");
      text = text.replace(/^\s+/, "");
      text = text.replace(/\s+$/g, "");

      // Save a copy of the un-highlighted text for the checkpoint.
      const checkpointText = text;

      // Highlight usernames
      text = text.replace(/@\S+/g, `${usernameColor}$&${mainColor}`);
      // Highlight bold text
      text = text.replace(/\*([^*]+?)\*/g, `${boldColor}$1${mainColor}`);

      // Initial color, if it's not set
      if (!/^{#[0-9a-fA-F]{6}}/.test(text)) {
        text = mainColor + text;
      }

      console.log(text);

      cache.lastCacheTime = Date.now();
      cache.text = text;

      if (options?.checkpointCallback) {
        options.checkpointCallback({
          timeline,
          summary: checkpointText,
          lastCacheTime: cache.lastCacheTime,
        });
      }

      return text;
    });
  };
}

const getTickerText = getTickerTextWithCache(60);

// Handle the one message we care about
async function onReady(message: JSON) {
  console.log("onReady", message);

  const text = await getTickerText({
    checkpointCallback: (checkpoint) => {
      client.publish(checkpointTopic, JSON.stringify(checkpoint));
    },
  });
  client.publish(textTopic, JSON.stringify({ text }));
}

// Set up the connection, subscribe to the ready topic, and handle messages

const client = mqtt.connect(env.MQTT_URL, {
  reconnectPeriod: 0,
  username: env.MQTT_USER,
  password: env.MQTT_PASS,
});

client.on("error", (err) => {
  console.log("MQTT error:\n", err);
});

client.on("connect", () => {
  console.log("connected");
});

// We're ok just exiting here; the assumption is that this service is
// managed and will be restarted automatically.
// The same goes for any other crashes, so there's little to no error
// recovery in this code.
client.on("close", () => {
  console.log("disconnected");
  process.exit(0);
});

client.subscribe(readyTopic);
client.on("message", async (topic, message) => {
  if (topic === readyTopic) {
    await onReady(JSON.parse(message.toString()));
  } else {
    console.log("unhandled message", topic, message.toString());
  }
});
