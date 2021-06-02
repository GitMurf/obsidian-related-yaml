import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, View, ItemView } from 'obsidian';
import type moment from "moment";

declare global {
    interface Window {
        moment: typeof moment;
    }
}

const PLUGIN_NAME = 'Related YAML';
const VIEW_TYPE = 'related-yaml';

interface MyPluginSettings {
    mySetting: string;
    toggleSetting: boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    mySetting: 'default',
    toggleSetting: true
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
        console.log('loading plugin: ' + PLUGIN_NAME);
        await this.loadSettings();
        this.addSettingTab(new SampleSettingTab(this.app, this));

        //Load view
        this.registerView(
            VIEW_TYPE,
            (leaf: WorkspaceLeaf) => (this.view = new RelatedYamlView(leaf))
        );

        unloadViews(this.app, VIEW_TYPE);
        this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
    }

    async onLayoutReady() {
        let viewCount: number = this.app.workspace.getLeavesOfType(VIEW_TYPE).length;
        if (viewCount == 0) {
            await this.app.workspace.getRightLeaf(false).setViewState({
                type: VIEW_TYPE,
            });
        }
    }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
    }

    async onunload() {
        console.log('unloading plugin: ' + PLUGIN_NAME);
        unloadViews(this.app, VIEW_TYPE)
    }
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
        let { containerEl } = this;
        containerEl.empty();
		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue('')
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Toggle")
            .setDesc("I am a toggle.")
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.toggleSetting);
                toggle.onChange(async (value) => {
                    this.plugin.settings.toggleSetting = value;
                    await this.plugin.saveSettings();
                });
            });
    }
}

class RelatedYamlView extends ItemView {

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
/*
    this.redraw = this.redraw.bind(this);
    this.redraw_debounced = this.redraw_debounced.bind(this);
    this.containerEl = this.containerEl;
    this.registerEvent(this.app.workspace.on("layout-ready", this.redraw_debounced));
    this.registerEvent(this.app.workspace.on("file-open", this.redraw_debounced));
    this.registerEvent(this.app.workspace.on("quick-preview", this.redraw_debounced));
    this.registerEvent(this.app.vault.on("delete", this.redraw));
*/
    }

    getViewType(): string {
        return VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Related YAML";
    }

    getIcon(): string {
        return "cloud";
    }

    onClose(): Promise<void> {
        return Promise.resolve();
    }

    async onOpen(): Promise<void> {
        //this.redraw();
        return Promise.resolve();
    }
}

function unloadViews(app: App, viewType: string): void {
    app.workspace
        .getLeavesOfType(viewType)
        .forEach((leaf: WorkspaceLeaf) => leaf.detach())
}