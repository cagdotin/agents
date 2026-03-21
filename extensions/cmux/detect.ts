import { execSync } from "node:child_process";

/** Check if we're running inside cmux by walking the process tree */
export function is_cmux(): boolean {
	// Fast path: cmux sets these env vars in its terminals
	if (process.env.CMUX_WORKSPACE_ID || process.env.CMUX_SURFACE_ID) {
		return true;
	}

	// Slow path: walk the process tree looking for cmux
	try {
		let pid = process.pid;
		for (let i = 0; i < 10; i++) {
			const ppid = execSync(`ps -o ppid= -p ${pid}`, { encoding: "utf-8", timeout: 1000 }).trim();
			if (!ppid || ppid === "0") break;
			const comm = execSync(`ps -o comm= -p ${ppid}`, { encoding: "utf-8", timeout: 1000 }).trim();
			if (comm.includes("cmux")) return true;
			pid = Number.parseInt(ppid, 10);
			if (Number.isNaN(pid)) break;
		}
	} catch {
		// ps failed — not fatal
	}

	return false;
}

/** Check if the cmux CLI is available */
export function has_cmux_cli(): boolean {
	try {
		execSync("cmux version", { encoding: "utf-8", timeout: 2000, stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}
