import * as webllm from "@mlc-ai/web-llm";
import { Point } from "./point";
import { Layer } from "./renderer";
import { GameSettings } from "./game-settings";
import { MapWorld } from "./map-world";
import { positionToIndex } from "./misc-utility";
import { TileStats } from "./web-components/tile-info";
import { ActorBase } from "./actor";
import { Tile } from "./tile";

export interface LLMStatus {
  id: string;
  status: string;
  statusEmoji: string;
}

export interface LLMActorStatus {
  thought: string;
  statusEmoji: string;
  color: string;
}

export class SystemLLM {
  public static engine: webllm.WebWorkerMLCEngine | null = null;

  public static async init() {
    if (!GameSettings.options.toggles.enableLLM) {
      return;
    }
  }

  public static async getStatusFor(
    actor: ActorBase,
    map: MapWorld
  ): Promise<LLMActorStatus> {
    const terrainPos = Tile.translatePoint(
      actor.position,
      actor.layer,
      Layer.TERRAIN
    );
    const positionInfo = map.getInfoAt(terrainPos.x, terrainPos.y);
    const messages = this.generateActorStatusRequest(positionInfo, actor);
    return this.sendRequest(messages).then((response) =>
      this.processActorStatusResponse(response)
    );
  }

  public static async getStatusAt(
    pos: Point,
    layer: Layer,
    map: MapWorld
  ): Promise<LLMStatus> {
    const index = positionToIndex(pos.x, pos.y, layer);
    if (!GameSettings.options.toggles.enableLLM) {
      return Promise.resolve({
        id: String(index),
        status: "No LLM",
        statusEmoji: "😞",
      });
    }

    const info = map.getInfoAt(pos.x, pos.y);
    const messages = this.generateStatusRequest(info);
    return Promise.resolve(
      this.sendRequest(messages).then((response) =>
        this.processStatusResponse(response)
      )
    );
  }

  private static async sendRequest(
    messages: webllm.ChatCompletionMessageParam[]
  ): Promise<webllm.ChatCompletion> {
    // Communicate with the local Jan server
    try {
      console.log("about to make a request");
      const request = await fetch("http://127.0.0.1:1337/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3.2:3b", // #1
          messages,
          max_tokens: 128,
        }),
      });

      if (!request.ok) {
        throw new Error(`HTTP error! status: ${request.status}`);
      }

      const data = await request.json();

      if (!data || !data.choices || !data.choices[0]) {
        throw new Error("Invalid response from Jan server");
      }

      return data;

      // return this.processStatusResponse(data);
    } catch (error) {
      console.error("Error communicating with Jan server:", error);
      throw new Error("Failed to get response from Jan server");
    }
  }

  private static processStatusResponse(
    response: webllm.ChatCompletion
  ): LLMStatus {
    let content = response.choices[0].message.content;

    // fix for emoji not being wrapped in quotes
    content.replace(
      /\\u[0-9A-Fa-f]{4}(\\u[0-9A-Fa-f]{4})?/g,
      (match) => `"${match}"`
    );

    // structured as "id|status|statusEmoji"
    // e.g. "0|Too hot to handle|🔥"
    const parts = content
      .split("|")
      .map((part) => part.trim())
      .filter((part) => part !== "");
    if (parts.length < 3) {
      throw new Error("Invalid response format from Jan server");
    }
    return {
      id: parts[0],
      status: parts[1],
      statusEmoji: parts[2],
    };
  }

  private static processActorStatusResponse(
    response: webllm.ChatCompletion
  ): LLMActorStatus {
    let content = response.choices[0].message.content;

    // fix for emoji not being wrapped in quotes
    content.replace(
      /\\u[0-9A-Fa-f]{4}(\\u[0-9A-Fa-f]{4})?/g,
      (match) => `"${match}"`
    );

    // structured as "id|thought|statusEmoji|color"
    // e.g. "0|Too hot to handle|🔥"
    const parts = content
      .split("|")
      .map((part) => part.trim())
      .filter((part) => part !== "");
    if (parts.length < 3) {
      throw new Error("Invalid response format from Jan server");
    }
    return {
      thought: parts[0],
      statusEmoji: parts[1],
      color: parts[2],
    };
  }

  private static generateStatusRequest(
    tileStats: TileStats
  ): webllm.ChatCompletionMessageParam[] {
    return [
      {
        role: "system",
        content: `VERY IMPORTANT: Your response should be a single line with 3 sections, separated by | character. There should be no other characters.`,
      },
      {
        role: "user",
        content: `Climate requirements (not part of response), where the middle of the range is "best": ${JSON.stringify(
          tileStats.biome.generationOptions
        )} 
        Position Status: ${JSON.stringify(tileStats)}.
        Response Format: Send a single line with three sections, separated by | character.
        First line: whole number starting at 0.
        Second line: a 3 - 7 word humorously wry alliteration about the climate, very short.
        Third line: a text emoji representing its suitability to its biome.`,
      },
      {
        role: "system",
        content: `DON'T FORGET THE | CHARACTER BETWEEN EACH SECTION. DON'T FORGET TO BE ALLITERATIVE WITH WRY HUMOR.`,
      },
    ];
  }

  private static generateActorStatusRequest(
    tileStats: TileStats,
    actor: ActorBase
  ): webllm.ChatCompletionMessageParam[] {
    const actorPrimitiveProps = Object.fromEntries(
      Object.entries(actor).filter(([_, value]) => typeof value !== "object")
    );

    return [
      {
        role: "system",
        content: `VERY IMPORTANT: Your response should be a single line with 3 sections, separated by | character. There should be no other characters.`,
      },
      {
        role: "user",
        content: `Climate requirements (not part of response), where the middle of the range is "best": ${JSON.stringify(
          tileStats.biome.generationOptions
        )} 
        Position Status: ${JSON.stringify(tileStats)}.
        Actor Status: ${JSON.stringify(actorPrimitiveProps)}.
        Response Format: Send a single line with multiple sections, separated by | character.
        First section: SINGLE SENTENCE thought based on how the actor feels. TEXT ONLY, NO EMOJIS, NO SPECIAL CHARACTERS. VERY SHORT, wry humor, alliteration.
        Second section: a text emoji representing the actor's mental state.
        Third section: a hex color representing the actor's mental state.`,
      },
      {
        role: "system",
        content: `DON'T FORGET THE | CHARACTER BETWEEN EACH SECTION. DON'T FORGET TO BE ALLITERATIVE WITH WRY HUMOR.`,
      },
    ];
  }
}
