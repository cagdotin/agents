import { DynamicBorder, type Theme } from "@mariozechner/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@mariozechner/pi-tui";

export class TodoDeleteConfirmComponent extends Container {
	private select_list: SelectList;
	private on_confirm: (confirmed: boolean) => void;

	constructor(theme: Theme, message: string, on_confirm: (confirmed: boolean) => void) {
		super();
		this.on_confirm = on_confirm;

		const options: SelectItem[] = [
			{ value: "yes", label: "Yes" },
			{ value: "no", label: "No" },
		];

		this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
		this.addChild(new Text(theme.fg("accent", message)));

		this.select_list = new SelectList(options, options.length, {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});

		this.select_list.onSelect = (item) => this.on_confirm(item.value === "yes");
		this.select_list.onCancel = () => this.on_confirm(false);

		this.addChild(this.select_list);
		this.addChild(new Text(theme.fg("dim", "Enter to confirm • Esc back")));
		this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
	}

	handleInput(key_data: string): void {
		this.select_list.handleInput(key_data);
	}

	override invalidate(): void {
		super.invalidate();
	}
}
