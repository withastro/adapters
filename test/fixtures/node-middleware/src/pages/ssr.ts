export async function GET() {
	let number = Math.random();
	return {
		body: JSON.stringify({
			number,
			message: `Here's a random number: ${number}`,
		}),
	};
}
