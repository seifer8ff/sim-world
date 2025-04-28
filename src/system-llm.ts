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
  statusColor: string;
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
          // model: "llama3.2:3b", // #1
          model: "mistral:7b", // #1
          messages,
          max_tokens: 128,
          response_format: { type: "json_object" },
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
    try {
      // read the json object from the content
      const parsedStatus: LLMStatus = JSON.parse(content);
      return parsedStatus;
    } catch (error) {
      console.error("Error parsing JSON:", error);
      throw new Error(
        "Failed to parse JSON response from Jan server. TODO: retry request."
      );
    }
  }

  private static processActorStatusResponse(
    response: webllm.ChatCompletion
  ): LLMActorStatus {
    let content = response.choices[0].message.content;

    try {
      // read the json object from the content
      const parsedStatus: LLMActorStatus = JSON.parse(content);
      console.log("parsedActorStatus", parsedStatus);
      return parsedStatus;
    } catch (error) {
      console.error("Error parsing JSON:", error);
      throw new Error(
        "Failed to parse JSON response from Jan server. TODO: retry request."
      );
    }
  }

  private static generateStatusRequest(
    tileStats: TileStats
  ): webllm.ChatCompletionMessageParam[] {
    return [
      {
        role: "system",
        content: `Reply ONLY with a JSON object matching this structure:
        \n\n{\n  \"id\": \"number\",\n  \"status\": \"string\",\n  \"statusEmoji\": string\n}\n\nExample:\n{\n  \"id\": 0,\n  \"status\": \"Bright and buzzy morning\",\n  \"statusEmoji\": \"\u{1F60A}\"\n }\n\nDo not add any commentary or explanation. Reply ONLY with a valid JSON object.
        `,
      },
      {
        role: "user",
        content: `Climate requirements (not part of response), where the middle of the range is "best": ${JSON.stringify(
          tileStats.biome.generationOptions
        )} 
        Position Status: ${JSON.stringify(tileStats)}.
        Response: Send a JSON object with the following fields:
        id: ascending  whole number starting at 0.
        statusEmoji: a 3 - 7 word humorously wry alliteration about the climate, very short.
        emoji: a unicode emoji representing its suitability to its biome.`,
      },
      {
        role: "system",
        content: `Reply ONLY with a JSON object matching this structure:
        \n\n{\n  \"id\": \"number\",\n  \"status\": \"string\",\n  \"statusEmoji\": string\n}\n\nExample:\n{\n  \"id\": 0,\n  \"status\": \"Bright and buzzy morning\",\n  \"statusEmoji\": \"\u{1F60A}\"\n }\n\nDo not add any commentary or explanation. Reply ONLY with a valid JSON object.
        `,
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
        content: `Reply ONLY with a JSON object matching this structure:
        \n\n{\n  \"status\": \"string\",\n  \"statusEmoji\": \"string\",\n  \"statusColor\": string\n}\n\nExample:\n{\n  \"status\": \"Bright and buzzy morning\",\n  \"statusEmoji\": \"\u{1F60A}\",\n  \"statusColor\": \"#0000FF\"\n }\n\nDo not add any commentary or explanation. Reply ONLY with a valid JSON object.
        `,
      },
      {
        role: "user",
        content: `Climate requirements (not part of response), where the middle of the range is "best": ${JSON.stringify(
          tileStats.biome.generationOptions
        )} 
        Position Status: ${JSON.stringify(tileStats)}.
        Actor Status: ${JSON.stringify(actorPrimitiveProps)}.
        Response: Send a JSON object with the following fields:
        status: SINGLE SENTENCE thought based on how the actor feels. TEXT ONLY, NO EMOJIS, NO SPECIAL CHARACTERS. VERY SHORT, wry humor, alliteration.
        statusEmoji: a unicode emoji representing the actor's mental state.
        statusColor: a hex color representing the actor's mental state.`,
      },
      {
        role: "system",
        content: `Reply ONLY with a JSON object matching this structure:
        \n\n{\n  \"status\": \"string\",\n  \"statusEmoji\": \"string\",\n  \"statusColor\": string\n}\n\nExample:\n{\n  \"status\": \"Bright and buzzy morning\",\n  \"statusEmoji\": \"\u{1F60A}\",\n  \"statusColor\": \"#0000FF\"\n }\n\nDo not add any commentary or explanation. Reply ONLY with a valid JSON object.
        `,
      },
    ];
  }
}
