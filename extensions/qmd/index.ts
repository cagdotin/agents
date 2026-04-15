import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { register_init_command } from "./commands/init.js";
import { close_store } from "./core/qmd-store.js";
import { register_indexed_feature } from "./features/indexed.js";

export default function qmd_extension(pi: ExtensionAPI) {
	register_indexed_feature(pi);
	register_init_command(pi);

	pi.on("session_shutdown", async () => {
		await close_store();
	});
}
