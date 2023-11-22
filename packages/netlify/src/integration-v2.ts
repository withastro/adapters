import { getIntegration } from "./integration-base.ts";
import type { Options } from "./shared.ts";

export default function (options: Omit<Options, "builders">) {
    return getIntegration({
        ...options,
        adapterName: "@astrojs/netlify/v2",
        functionType: "v2"
    });
}
