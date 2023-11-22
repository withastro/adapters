import { getIntegration } from "./integration-base.ts";
import type { Options } from "./shared.ts";
import type { Connect } from "vite";

export default function (options: Omit<Options, "builders">) {
    return getIntegration({
        ...options,
        adapterName: "@astrojs/netlify/v2",
        functionType: "v2",
        devMiddleware
    });
}

function devMiddleware([ request ]: Parameters<Connect.SimpleHandleFunction>) {
    const context = Object.assign(Object.create(duplicatedContext), demoContext, { rewrite })
    Reflect.set(
        request,
        Symbol.for("astro.locals"),
        { context }
    );
}

// these properties of netlify context have equivalents in Astro
// we want to avoid providing multiple ways of doing the same thing
const duplicatedContext = {
    get cookies() { throw new Error("Please use Astro.cookies or context.cookies instead.") },
    get ip () { throw new Error("Please use Astro.clientAddress or context.clientAddress instead.") },
    get json() { throw new Error("Please use Response.json instead.") },
    get params() { throw new Error("Please use Astro.params or context.params instead.") },
}

const demoContext = {
    account: { id: '66825ac773b8b53ec7a92755' },
    deploy: { id: '67a781b80398785b0bb556f2' },
    geo: {
        city: 'Zurich',
        country: { code: 'CH', name: 'Switzerland' },
        subdivision: { code: 'ZH', name: 'Zurich' },
        timezone: 'Europe/Zurich',
        latitude: 47.3682,
        longitude: 8.5671
    },
    log: console.log,
    requestId: '01HFT9RZXSW1GPBE2TT7HWAJPQ',
    server: { region: 'us-east-1' },
    site: {
        id: '345f2a26-befd-45f1-ada1-655d33d6e3d8',
        name: 'your-site-name',
        url: 'https://your-site-name.netlify.app'
    }
}

function rewrite(input: string | URL, orginalUrl: string) {
    
    const destinationUrl =
        input instanceof URL ? input :
        input.startsWith("/") ? new URL(input, orginalUrl) :
        new URL(input);
    
    return fetch(destinationUrl);
}
