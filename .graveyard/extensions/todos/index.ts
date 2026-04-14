import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { create_todos_command } from "./command.js";
import {
	ensure_todos_dir,
	garbage_collect_todos,
	get_todos_dir,
	get_todos_dir_label,
	migrate_todo_filenames,
	read_todo_settings,
} from "./storage.js";
import { create_todo_tool } from "./tool.js";

export default function todos_extension(pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const todos_dir = get_todos_dir(ctx.cwd);
		await ensure_todos_dir(todos_dir);
		await migrate_todo_filenames(todos_dir);
		const settings = await read_todo_settings(todos_dir);
		await garbage_collect_todos(todos_dir, settings);
	});

	const todos_dir_label = get_todos_dir_label(process.cwd());

	pi.registerTool(create_todo_tool(todos_dir_label));
	pi.registerCommand("todos", create_todos_command());
}
