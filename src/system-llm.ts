import * as webllm from "@mlc-ai/web-llm";
import { Type } from "@sinclair/typebox";
import { Point } from "./point";
import { Layer } from "./renderer";
import { GameSettings } from "./game-settings";
import { Biomes } from "./biomes";
import { MapWorld } from "./map-world";
import { positionToIndex } from "./misc-utility";

export interface LLMStatus {
  id: string;
  status: string;
  statusEmoji: string;
}

export class SystemLLM {
  public static engine: webllm.WebWorkerMLCEngine | null = null;
  // Define the JSON schema for the plant status
  private static StatusSchema = Type.Object({
    id: Type.String(),
    status: Type.String(),
    statusEmoji: Type.String(),
  });
  private static schema = JSON.stringify(this.StatusSchema);

  public static async init() {
    if (!GameSettings.options.toggles.enableLLM) {
      return;
    }
    const initProgressCallback = (report) => {
      console.log("Model loading progress:", report.text);
    };
    const selectedModel = "Llama-3.1-8B-Instruct-q4f32_1-MLC";

    // smallest and fastest model
    // very poor performance, doesn't do alliteration or emojies or make sense
    // const modelConfig: webllm.ModelRecord = {
    //   model_id: "SmolLM-135M-Instruct-q0f16-MLC",
    //   model:
    //     "https://huggingface.co/mlc-ai/SmolLM-135M-Instruct-q0f16-MLC/resolve/main/",
    //   model_lib:
    //     // "https://mlc.ai/mlc-web-models/weights/SmolLM-135M-Instruct-q0f16-ctx2k_cs1k-webgpu.wasm",
    //     "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_48/SmolLM-135M-Instruct-q0f16-ctx2k_cs1k-webgpu.wasm",
    //   low_resource_required: true,
    //   overrides: {
    //     context_window_size: 2048,
    //   },
    // };

    // const modelConfig: webllm.ModelRecord = {
    //   model_id: "SmolLM-360M-Instruct-q4f16_1-MLC",
    //   model:
    //     "https://huggingface.co/mlc-ai/SmolLM-360M-Instruct-q4f16_1-MLC/resolve/main/",
    //   model_lib:
    //     "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_48/SmolLM-360M-Instruct-q4f16_1-ctx2k_cs1k-webgpu.wasm",
    //   // low_resource_required: true,
    //   // overrides: {
    //   //   context_window_size: 2048,
    //   // },
    // };

    // const modelConfig: webllm.ModelRecord = {
    //   model_id: "SmolLM2-360M-Instruct-q0f16-MLC",
    //   model:
    //     "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q0f16-MLC/resolve/main/",
    //   model_lib:
    //     "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_48/SmolLM2-360M-Instruct-q0f16-ctx4k_cs1k-webgpu.wasm",
    //   low_resource_required: true,
    //   overrides: {
    //     context_window_size: 2048,
    //   },
    // };

    // const modelConfig: webllm.ModelRecord = {
    //   model_id: "SmolLM2-360M-Instruct-q0f16-MLC",
    //   model:
    //     "https://huggingface.co/mlc-ai/SmolLM2-1.7B-Instruct-q4f16_1-MLC/resolve/main/",
    //   model_lib:
    //     "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_48//SmolLM2-1.7B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
    //   low_resource_required: true,
    //   overrides: {
    //     context_window_size: 2048,
    //   },
    // };

    // const modelConfig: webllm.ModelRecord = {
    //   model_id: "SmolLM2-360M-Instruct-q0f16-MLC",
    //   model:
    //     "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/main/",
    //   model_lib:
    //     "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_48/Llama-3.2-3B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
    //   low_resource_required: true,
    //   overrides: {
    //     context_window_size: 2048,
    //   },
    // };

    console.log("Start LLM engine");
    this.engine = await webllm.CreateWebWorkerMLCEngine(
      new Worker(new URL("./web-llm-worker.ts", import.meta.url), {
        type: "module",
      }),
      selectedModel,
      {
        initProgressCallback: initProgressCallback,
        // logLevel: "DEBUG",
      }
    );
    // this.engine = await webllm.CreateWebWorkerMLCEngine(
    //   new Worker(new URL("./web-llm-worker.ts", import.meta.url), {
    //     type: "module",
    //   }),
    //   modelConfig.model_id,
    //   {
    //     appConfig: {
    //       model_list: [modelConfig],
    //     },
    //     initProgressCallback: initProgressCallback,
    //     // logLevel: "DEBUG",
    //   }
    // );
  }

  private static async sendRequest(
    messages: webllm.ChatCompletionMessageParam[]
  ): Promise<LLMStatus> {
    const request: webllm.ChatCompletionRequestNonStreaming = {
      stream: false, // Explicitly set to 'false'
      messages,
      max_tokens: 128,
      response_format: {
        type: "json_object",
        schema: this.schema,
      },
    };

    const reply = await this.engine.chat.completions.create(request);

    if (
      !reply ||
      !reply.choices ||
      !reply.choices[0] ||
      !reply.choices[0].message ||
      !reply.choices[0].message.content
    ) {
      throw new Error("Invalid response from LLM");
    }

    console.log("resonse", reply);
    const response: LLMStatus = JSON.parse(reply.choices[0].message.content);

    // console.log(`Response: ${response.status} ${response.statusEmoji}`);
    return response;
  }

  // public static async getStatusAt(
  //   pos: Point,
  //   layer: Layer,
  //   map: MapWorld
  // ): Promise<LLMStatus> {
  //   // return after two seconds
  //   const index = positionToIndex(pos.x, pos.y, layer);
  //   return new Promise((resolve) => {
  //     // return after two seconds
  //     setTimeout(() => {
  //       return resolve({
  //         id: String(index),
  //         status: "No LLM",
  //         statusEmoji: "😞",
  //       })
  //     }, 2000) // Simulate async operation with a timeout
  //   });
  // }

  public static async getStatusAt(
    pos: Point,
    layer: Layer,
    map: MapWorld
  ): Promise<LLMStatus> {
    const index = positionToIndex(pos.x, pos.y, layer);
    if (!GameSettings.options.toggles.enableLLM || this.engine == null) {
      return Promise.resolve({
        id: String(index),
        status: "No LLM",
        statusEmoji: "😞",
      });
    }

    const info = map.getInfoAt(pos.x, pos.y);
    const messages: webllm.ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: `Given the following biome requirements, where the middle of the range is "best": ${JSON.stringify(
          info.biome.generationOptions
        )} and position status: ${JSON.stringify(
          info
        )}, provide a short, wry alliteration about the locations's current climate (one sentence, 3-6 words) and an emoji representing its suitability to its biome  in JSON format. The JSON should match this schema: ${
          this.schema
        }`,
      },
    ];
    console.log("send request:", messages);
    return Promise.resolve(this.sendRequest(messages));
  }
}
