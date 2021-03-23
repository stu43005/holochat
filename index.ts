import express from "express";
import { collectDefaultMetrics, register } from "prom-client";
import { fetchChannel } from "./live-chat";

collectDefaultMetrics();

// process event handle
process
	.on("warning", console.warn)
	.on("unhandledRejection", (error) => {
		console.error("Unhandled Promise Rejection:", error?.toString());
	})
	.on("uncaughtException", (error) => {
		console.error("Uncaught Exception:", error);
		process.exit(1);
	});

fetchChannel();

// main event loop
global.setInterval(async () => {
	try {
		await fetchChannel();
	}
	catch (error) {
		console.error("fetchChannel error");
	}
}, 60 * 1000);

// init express server
const app = express();
app.get("/", (req, res) => {
	res.status(200).json({
		ok: true,
	});
});
app.get("/metrics", async (_req, res) => {
	try {
		res.set("Content-Type", register.contentType);
		res.end(await register.metrics());
	}
	catch (err) {
		res.status(500).end(err);
	}
});
const listener = app.listen(process.env.PORT || 8080, () => {
	const addr = listener.address();
	console.log("Your app is listening on port " + (typeof addr === "string" ? addr : addr?.port));
});
