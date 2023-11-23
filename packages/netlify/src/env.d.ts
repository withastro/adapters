/// <reference types="astro/client" />

import type { Context } from '@netlify/functions';

declare namespace App {
	interface Locals {
		netlify: {
			context: Context;
		};
	}
}
