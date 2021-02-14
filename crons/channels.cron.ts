import { CronJob } from "cron";
import { fetchChannel } from "../live-chat";

// every minutes
export default function () {
	return new CronJob("* * * * *", async () => {
		try {
			await fetchChannel();
		}
		catch (error) {
			console.error("fetchChannel error");
		}
	});
}
