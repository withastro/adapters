declare module 'astro:env/client' {
	export const PUBLIC_API_URL: string | undefined;	

}

declare module 'astro:env/server' {
	export const PUBLIC_PORT: number;	


	type SecretValues = {
		API_SECRET: string;		

	};

	type SecretValue = keyof SecretValues;

	type Loose<T> = T | (string & {});
	type Strictify<T extends string> = T extends `${infer _}` ? T : never;

	export const getSecret: <TKey extends Loose<SecretValue>>(
		key: TKey
	) => TKey extends Strictify<SecretValue> ? SecretValues[TKey] : string | undefined;
}
