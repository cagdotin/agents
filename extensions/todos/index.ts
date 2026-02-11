import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	get_todos_dir,
	get_todos_dir_label,
	ensure_todos_dir,
	read_todo_settings,
	garbage_collect_todos,
} from "./storage.js";
import { create_todo_tool } from "./tool.js";
import { create_todos_command } from "./command.js";

export default function todos_extension(pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const todos_dir = get_todos_dir(ctx.cwd);
		await ensure_todos_dir(todos_dir);
		const settings = await read_todo_settings(todos_dir);
		await garbage_collect_todos(todos_dir, settings);
	});

	const todos_dir_label = get_todos_dir_label(process.cwd());

	pi.registerTool(create_todo_tool(todos_dir_label));
	pi.registerCommand("todos", create_todos_command());
}
