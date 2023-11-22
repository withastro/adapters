import { getIntegration } from "./integration-base.ts";
import type { Options } from "./shared.ts";

export default function (options: Options) {
    return getIntegration({
        ...options,
        adapterName: "@astrojs/netlify/lambda",
        functionType: "lambda-compatible"
    });
}
