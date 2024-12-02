import { defineAction } from 'astro:actions';

export const server = {
    test: defineAction({
        handler: () => {
            return { message: 'Hello from server!' }
        }
    })
}