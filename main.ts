import {
	App,
	ItemView,
	Plugin,
	PluginSettingTab,
	Setting,
	WorkspaceLeaf,
	TFile,
	Menu,
	Notice,
	setIcon,
} from "obsidian";
import * as fs from "fs";
import * as path from "path";

const VIEW_TYPE_FULL_EXPLORER = "full-file-explorer-view";

interface FullExplorerSettings {
	showFiles: boolean;
	excludePatterns: string[];
}

const DEFAULT_SETTINGS: FullExplorerSettings = {
	showFiles: true,
	excludePatterns: [".DS_Store", ".Trash", "node_modules"],
};

interface FileEntry {
	name: string;
	path: string;
	isDirectory: boolean;
	isHidden: boolean;
}

class FullExplorerView extends ItemView {
	plugin: FullExplorerPlugin;
	private expandedFolders: Set<string> = new Set();

	constructor(leaf: WorkspaceLeaf, plugin: FullExplorerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_FULL_EXPLORER;
	}

	getDisplayText(): string {
		return "Full Explorer";
	}

	getIcon(): string {
		return "folder-tree";
	}

	async onOpen() {
		this.contentEl.empty();
		this.contentEl.addClass("full-explorer");

		// Add header with refresh button
		const header = this.contentEl.createDiv({ cls: "full-explorer-header" });
		header.createEl("span", { text: "Full Explorer", cls: "full-explorer-title" });

		const refreshBtn = header.createEl("button", { cls: "full-explorer-refresh" });
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.setAttribute("aria-label", "Refresh");
		refreshBtn.onclick = () => this.refresh();

		// Create tree container
		const treeContainer = this.contentEl.createDiv({ cls: "full-explorer-tree" });

		await this.renderTree(treeContainer);
	}

	async refresh() {
		const treeContainer = this.contentEl.querySelector(".full-explorer-tree");
		if (treeContainer) {
			treeContainer.empty();
			await this.renderTree(treeContainer as HTMLElement);
		}
	}

	private async renderTree(container: HTMLElement) {
		const vaultPath = this.getVaultPath();

		if (!vaultPath) {
			container.createEl("p", { text: "Could not determine vault path" });
			return;
		}

		try {
			const entries = await this.scanEntries(vaultPath, "");

			if (entries.length === 0) {
				container.createEl("p", {
					text: "No files found",
					cls: "full-explorer-empty"
				});
				return;
			}

			for (const entry of entries) {
				await this.renderEntry(container, entry, 0);
			}
		} catch (error) {
			container.createEl("p", { text: `Error scanning: ${error}` });
		}
	}

	private getVaultPath(): string | null {
		const adapter = this.app.vault.adapter;
		if ("basePath" in adapter) {
			return (adapter as any).basePath;
		}
		return null;
	}

	private async scanEntries(dirPath: string, relativePath: string): Promise<FileEntry[]> {
		const entries: FileEntry[] = [];
		const settings = this.plugin.settings;

		try {
			const items = fs.readdirSync(dirPath);

			for (const item of items) {
				// Skip excluded patterns
				if (settings.excludePatterns.includes(item)) continue;

				const fullPath = path.join(dirPath, item);
				const itemRelativePath = relativePath ? path.join(relativePath, item) : item;
				const isHidden = item.startsWith(".");

				try {
					const stat = fs.statSync(fullPath);
					const isDirectory = stat.isDirectory();

					// Skip files if setting is disabled
					if (!isDirectory && !settings.showFiles) continue;

					entries.push({
						name: item,
						path: itemRelativePath,
						isDirectory,
						isHidden,
					});
				} catch {
					// Skip items we can't stat (permission issues)
				}
			}

			// Sort: folders first, then alphabetically (hidden files mixed in)
			entries.sort((a, b) => {
				if (a.isDirectory && !b.isDirectory) return -1;
				if (!a.isDirectory && b.isDirectory) return 1;
				return a.name.localeCompare(b.name);
			});

		} catch (error) {
			console.error("Error scanning directory:", error);
		}

		return entries;
	}

	private async renderEntry(container: HTMLElement, entry: FileEntry, depth: number) {
		const vaultPath = this.getVaultPath();
		if (!vaultPath) return;

		const itemEl = container.createDiv({ cls: "full-explorer-item" });
		itemEl.style.paddingLeft = `${depth * 16 + 8}px`;

		const isExpanded = this.expandedFolders.has(entry.path);

		// Create row with icon and name
		const rowEl = itemEl.createDiv({
			cls: `full-explorer-item-row ${entry.isHidden ? "is-hidden" : ""}`
		});

		if (entry.isDirectory) {
			// Folder expand/collapse chevron
			const chevron = rowEl.createSpan({ cls: "full-explorer-chevron" });
			setIcon(chevron, isExpanded ? "chevron-down" : "chevron-right");

			const icon = rowEl.createSpan({ cls: "full-explorer-icon" });
			setIcon(icon, isExpanded ? "folder-open" : "folder");

			rowEl.createSpan({ text: entry.name, cls: "full-explorer-name" });

			rowEl.onclick = async () => {
				if (this.expandedFolders.has(entry.path)) {
					this.expandedFolders.delete(entry.path);
				} else {
					this.expandedFolders.add(entry.path);
				}
				await this.refresh();
			};

			// Render children if expanded
			if (isExpanded) {
				const fullPath = path.join(vaultPath, entry.path);
				const children = await this.scanEntries(fullPath, entry.path);

				for (const child of children) {
					await this.renderEntry(container, child, depth + 1);
				}
			}
		} else {
			// File - no chevron, just indent space
			rowEl.createSpan({ cls: "full-explorer-chevron-spacer" });

			const icon = rowEl.createSpan({ cls: "full-explorer-icon" });
			setIcon(icon, this.getFileIcon(entry.name));

			rowEl.createSpan({ text: entry.name, cls: "full-explorer-name" });

			rowEl.onclick = () => this.openFile(entry.path);
		}

		// Context menu
		rowEl.oncontextmenu = (event) => {
			event.preventDefault();
			this.showContextMenu(event, entry);
		};
	}

	private getFileIcon(filename: string): string {
		const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : "";
		const name = filename.toLowerCase();

		// Special dot-files by full name
		const specialFiles: Record<string, string> = {
			".gitignore": "git-branch",
			".gitconfig": "git-branch",
			".gitmodules": "git-branch",
			".gitattributes": "git-branch",
			".npmrc": "package",
			".nvmrc": "package",
			".env": "lock",
			".env.local": "lock",
			".env.example": "lock",
			".prettierrc": "file-cog",
			".eslintrc": "file-cog",
			".editorconfig": "file-cog",
			".dockerignore": "container",
			".zshrc": "terminal",
			".bashrc": "terminal",
			".bash_profile": "terminal",
			".zprofile": "terminal",
		};

		if (specialFiles[name]) {
			return specialFiles[name];
		}

		// By extension
		const extIcons: Record<string, string> = {
			// Config
			json: "file-json",
			yaml: "file-cog",
			yml: "file-cog",
			toml: "file-cog",
			ini: "file-cog",
			conf: "file-cog",
			config: "file-cog",
			// Code
			js: "file-code",
			ts: "file-code",
			jsx: "file-code",
			tsx: "file-code",
			py: "file-code",
			rb: "file-code",
			go: "file-code",
			rs: "file-code",
			java: "file-code",
			c: "file-code",
			cpp: "file-code",
			h: "file-code",
			// Shell
			sh: "terminal",
			bash: "terminal",
			zsh: "terminal",
			fish: "terminal",
			// Text
			md: "file-text",
			txt: "file-text",
			log: "file-text",
			// Images
			png: "image",
			jpg: "image",
			jpeg: "image",
			gif: "image",
			svg: "image",
			webp: "image",
			ico: "image",
			// Data
			xml: "file-code",
			csv: "table",
			sql: "database",
			db: "database",
			// Archives
			zip: "package",
			tar: "package",
			gz: "package",
			// Keys/certs
			pem: "key",
			key: "key",
			crt: "key",
			pub: "key",
		};

		return extIcons[ext || ""] || "file";
	}

	private async openFile(relativePath: string) {
		const vaultPath = this.getVaultPath();
		if (!vaultPath) return;

		const fullPath = path.join(vaultPath, relativePath);

		// Check if file exists in vault (Obsidian's view)
		const abstractFile = this.app.vault.getAbstractFileByPath(relativePath);

		if (abstractFile instanceof TFile) {
			// File is tracked by Obsidian, open normally
			await this.app.workspace.getLeaf().openFile(abstractFile);
		} else {
			// File is hidden from Obsidian, try to read and display content
			try {
				const content = fs.readFileSync(fullPath, "utf-8");

				new Notice(`Opened: ${relativePath}`);
				console.log(`Content of ${relativePath}:`, content);

				// Copy path to clipboard for convenience
				navigator.clipboard.writeText(fullPath);
				new Notice("Full path copied to clipboard");
			} catch (error) {
				new Notice(`Cannot open file: ${error}`);
			}
		}
	}

	private showContextMenu(event: MouseEvent, entry: FileEntry) {
		const menu = new Menu();
		const vaultPath = this.getVaultPath();

		menu.addItem((item) => {
			item.setTitle("Copy path")
				.setIcon("copy")
				.onClick(() => {
					const fullPath = vaultPath ? path.join(vaultPath, entry.path) : entry.path;
					navigator.clipboard.writeText(fullPath);
					new Notice("Path copied to clipboard");
				});
		});

		menu.addItem((item) => {
			item.setTitle("Reveal in Finder")
				.setIcon("folder")
				.onClick(() => {
					if (vaultPath) {
						const fullPath = path.join(vaultPath, entry.path);
						const { shell } = require("electron");
						shell.showItemInFolder(fullPath);
					}
				});
		});

		if (entry.isDirectory) {
			menu.addItem((item) => {
				item.setTitle("Open in terminal")
					.setIcon("terminal")
					.onClick(() => {
						if (vaultPath) {
							const fullPath = path.join(vaultPath, entry.path);
							const { exec } = require("child_process");
							exec(`open -a Terminal "${fullPath}"`);
						}
					});
			});
		}

		menu.showAtMouseEvent(event);
	}

	async onClose() {
		// Cleanup
	}
}

export default class FullExplorerPlugin extends Plugin {
	settings: FullExplorerSettings;

	async onload() {
		await this.loadSettings();

		// Register the custom view
		this.registerView(
			VIEW_TYPE_FULL_EXPLORER,
			(leaf) => new FullExplorerView(leaf, this)
		);

		// Add ribbon icon
		this.addRibbonIcon("folder-tree", "Open Full Explorer", () => {
			this.activateView();
		});

		// Add command
		this.addCommand({
			id: "open-full-explorer",
			name: "Open Full Explorer",
			callback: () => {
				this.activateView();
			},
		});

		// Add settings tab
		this.addSettingTab(new FullExplorerSettingTab(this.app, this));
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_FULL_EXPLORER);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_FULL_EXPLORER)[0];

		if (!leaf) {
			const leftLeaf = workspace.getLeftLeaf(false);
			if (leftLeaf) {
				leaf = leftLeaf;
				await leaf.setViewState({
					type: VIEW_TYPE_FULL_EXPLORER,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class FullExplorerSettingTab extends PluginSettingTab {
	plugin: FullExplorerPlugin;

	constructor(app: App, plugin: FullExplorerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Full Explorer Settings" });

		new Setting(containerEl)
			.setName("Show files")
			.setDesc("Show files in addition to folders")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showFiles)
					.onChange(async (value) => {
						this.plugin.settings.showFiles = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Exclude patterns")
			.setDesc("Comma-separated list of names to exclude (e.g., .DS_Store, node_modules)")
			.addText((text) =>
				text
					.setPlaceholder(".DS_Store,.Trash,node_modules")
					.setValue(this.plugin.settings.excludePatterns.join(","))
					.onChange(async (value) => {
						this.plugin.settings.excludePatterns = value
							.split(",")
							.map((s) => s.trim())
							.filter((s) => s.length > 0);
						await this.plugin.saveSettings();
					})
			);
	}
}
