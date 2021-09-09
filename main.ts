import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, View, ItemView, Menu, TFile, TAbstractFile, TFolder, setIcon, FrontMatterCache } from 'obsidian';
import type moment from "moment";

declare global {
    interface Window {
        moment: typeof moment;
    }
}

declare module "obsidian" {
    interface Plugin {
        view: View;
    }
    interface WorkspaceLeaf {
        height: number;
    }
}

interface FileDates {
    file: TFile
    created: number
    modified: number
}

const PLUGIN_NAME = 'Related YAML';
const VIEW_TYPE = 'related-yaml';
let curYaml: FrontMatterCache;

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
        this.registerEvent(this.app.workspace.on('file-open', this.onFileChange.bind(this)));
        this.registerEvent(this.app.workspace.on('file-menu', this.onFileMenu.bind(this)));
        //Primarily for when switching between Edit and Preview mode
        this.registerEvent(this.app.workspace.on('layout-change', this.onLayoutChange.bind(this)));

        this.registerEvent(
            this.app.metadataCache.on('resolve', (file) => {
                if (this.app.workspace.layoutReady) {
                    //console.log('onMetaChange()');
                    if (this.app.workspace.getActiveFile() != file) return;
                    //console.time('onMetaChange');
                    if (isViewActive(this.app)) {
                        const mdCache = this.app.metadataCache.getCache(file.path);
                        if (JSON.stringify(curYaml) !== JSON.stringify(mdCache.frontmatter)) {
                            curYaml = mdCache.frontmatter;
                            //console.log('buildView');
                            buildView(this.app);
                        }
                    }
                    //console.timeEnd('onMetaChange');
                }
            })
        );
    }

    async onLayoutReady() {
        //console.log('layoutReady()')
        let viewCount: number = this.app.workspace.getLeavesOfType(VIEW_TYPE).length;
        if (viewCount == 0) {
            await this.app.workspace.getRightLeaf(false).setViewState({
                type: VIEW_TYPE,
            });
        }
        //showView(this.app);
        buildView(this.app);
    }

    onFileChange(): void {
        //console.log('onFileChange()');
        if (this.app.workspace.layoutReady) {
            //File change does not need to check for isViewActive() function
            buildView(this.app);
        }
    }

    onLayoutChange(): void {
        //console.log('onLayoutChange()');
        if (this.app.workspace.layoutReady) {
            //console.log('buildView');
            if (isViewActive(this.app)) { buildView(this.app); }
        }
    }

    onFileMenu(): void {
        //console.log('onFileMenu()');
    }

    async loadSettings() {
        //console.log('loadSettings()')
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

    async saveSettings() {
        //console.log('saveSettings()')
		await this.saveData(this.settings);
    }

    async onunload() {
        console.log('unloading plugin: ' + PLUGIN_NAME);
        unloadViews(this.app, VIEW_TYPE)
    }
}

function buildView(app: App) {
    //console.log('buildView()')
    const actFile = app.workspace.getActiveFile();
    const yamlLeaf: WorkspaceLeaf = app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    let yamlView: View;
    if (yamlLeaf) {
        yamlView = yamlLeaf.view;
    } else {
        return;
    }

    const clMainDiv = 'ry-main';
    const viewContentEl = yamlView.containerEl.querySelector('.view-content');
    const oldMain = viewContentEl.querySelector(`.${clMainDiv}`)
    if (oldMain) { viewContentEl.removeChild(oldMain) }

    //List all YAML keys/properties
    const mdCache = app.metadataCache.getCache(actFile.path);
    let yamlTmp = mdCache ? mdCache.frontmatter : null;
    let yaml: FrontMatterCache;
    //Using the JSON.parse() and JSON.stringify() so that it doesn't create a reference copy to the variable of the FrontMatterCache
        //because otherwise it will change the actual metadatacache when manipulating the yaml variable later in the function
    if (!yamlTmp) { yaml = { 'position': null } } else { yaml = JSON.parse(JSON.stringify(yamlTmp)); }
    if (yaml) {
        const mainDiv = viewContentEl.createDiv({ cls: clMainDiv });
        const refreshButton = mainDiv.createEl("button", { cls: "ry-refresh-button" })
        setIcon(refreshButton, 'switch');
        refreshButton.on("click", "button", (event) => {
            buildView(app);
        });
        const headerText = mainDiv.createEl('h3', { cls: 'ry-header', text: actFile.basename });
        const yamlKeysCont = mainDiv.createDiv({ cls: '' });
        const allFiles = app.vault.getMarkdownFiles();

        /*
        const t
        allFiles.forEach(eachFile => {
            
        });
*/
        const yKeys = Object.keys(yaml);
        if (!yKeys.includes('date created') && !yKeys.includes('Date Created')) { yKeys.push('date created'); yaml['date created'] = window.moment(actFile.stat.ctime).format('YYYY-MM-DD'); }
        if (!yKeys.includes('date updated') && !yKeys.includes('date modified')) { yKeys.push('date modified'); yaml['date modified'] = window.moment(actFile.stat.mtime).format('YYYY-MM-DD'); }
        yKeys.forEach(eachKey => {
            const otherArr: Array<any> = [];
            if (eachKey !== 'position') {
                const keyType = eachKey.toLowerCase() === 'date updated' || eachKey.toLowerCase() === 'date modified' || eachKey.toLowerCase() === 'date created' ? 'date' : 'string';
                const eachKeyPar = yamlKeysCont.createEl('details', { cls: '' });
                eachKeyPar.setAttribute("style", `margin-bottom: 5px`);
                const eachKeySum = eachKeyPar.createEl('summary', { cls: '' });
                eachKeySum.setAttribute("style", 'cursor: pointer;');
                const eachKeyDiv = eachKeySum.createDiv({ cls: '', text: `${eachKey}` });
                eachKeyDiv.setAttribute("style", 'display: inline-flex;');
                const eachKeyDet = eachKeyPar.createDiv({ cls: '' });

                const yamlKey = typeof yaml[eachKey] === 'number' ? yaml[eachKey].toString() : yaml[eachKey];
                const valArray: Array<string> = typeof yamlKey === 'string' ? [yamlKey] : yamlKey;
                if (Array.isArray(valArray)) {
                    if (keyType === 'date') {
                        if (eachKey.toLowerCase() === 'date created') { valArray.push(window.moment(actFile.stat.ctime).format('YYYY-MM-DD')) }
                        if (eachKey.toLowerCase() === 'date updated' || eachKey.toLowerCase() === 'date modified') { valArray.push(window.moment(actFile.stat.mtime).format('YYYY-MM-DD')) }
                    }
                    const eachValTmp: Array<string> = [];
                    valArray.forEach(eachVal => {
                        if (keyType === 'date') { eachVal = window.moment(eachVal).format('YYYY-MM-DD') }
                        if (!eachValTmp.includes(eachVal)) {
                            eachValTmp.push(eachVal);
                            const eachValPar = eachKeyDet.createEl('details', { cls: '' });
                            eachValPar.setAttribute("style", `margin-left: 15px; margin-top: 5px`);
                            const eachValSum = eachValPar.createEl('summary', { cls: '' });
                            eachValSum.setAttribute("style", 'cursor: pointer;');
                            const eachValDiv = eachValSum.createDiv({ cls: '', text: `${eachVal}` });
                            eachValDiv.setAttribute("style", 'display: inline-flex');
                            allFiles.forEach(eachFile => {
                                const eachCache = app.metadataCache.getCache(eachFile.path);
                                let eachYaml = eachCache ? eachCache.frontmatter : null;
                                if (!eachYaml) { eachYaml = { 'position': null } }
                                if (eachYaml) {
                                    if (eachYaml[eachKey] || keyType === 'date') {
                                        let valuesArr: Array<string> = []
                                        if (eachYaml[eachKey]) {
                                            const eachYamlKey = typeof eachYaml[eachKey] === 'number' ? eachYaml[eachKey].toString() : eachYaml[eachKey];
                                            valuesArr = typeof eachYamlKey === 'string' ? [eachYamlKey] : eachYamlKey;
                                        } else {
                                            if (keyType === 'date') {
                                                if (eachKey.toLowerCase() === 'date created') { valuesArr.push(window.moment(eachFile.stat.ctime).format('YYYY-MM-DD')) }
                                                if (eachKey.toLowerCase() === 'date updated' || eachKey.toLowerCase() === 'date modified') { valuesArr.push(window.moment(eachFile.stat.mtime).format('YYYY-MM-DD')) }
                                            }
                                        }
                                        if (Array.isArray(valuesArr)) {
                                            const eachFileValTmp: Array<string> = [];
                                            valuesArr.forEach(eachValue => {
                                                if (keyType === 'date') { eachValue = window.moment(eachValue).format('YYYY-MM-DD') }
                                                if (!eachFileValTmp.includes(eachValue)) {
                                                    eachFileValTmp.push(eachValue);
                                                    if (eachValue.toString().toLowerCase() === eachVal.toString().toLowerCase()) {
                                                        const eachValDet = eachValPar.createDiv({ cls: 'tree-item search-result' });
                                                        eachValDet.setAttribute("style", 'margin-bottom: 0px; margin-left: 10px;');
                                                        //const linkPar = eachValDet.createEl('p', { cls: '' });
                                                        const treeItem = eachValDet.createDiv({ cls: 'tree-item-self search-result-file-title is-clickable' });
                                                        treeItem.setAttribute("style", 'padding-left: 15px;');
                                                        const eachValLink = treeItem.createDiv({ cls: 'tree-item-inner', text: eachFile.basename });
                                                        eachValLink.setAttribute("style", 'cursor: pointer; border-bottom: 1px solid; border-bottom-color: var(--background-modifier-border); border-radius: 0px; padding-left: 5px;');

                                                        // Hover preview
                                                        eachValLink.addEventListener('mouseover', (event: MouseEvent) => {
                                                            app.workspace.trigger('hover-link', {
                                                                event,
                                                                source: VIEW_TYPE,
                                                                hoverParent: mainDiv,
                                                                targetEl: eachValLink,
                                                                linktext: eachFile.path,
                                                            });
                                                        });

                                                        //File context menu (right click)
                                                        eachValLink.addEventListener('contextmenu', (event: MouseEvent) => {
                                                            const leaf: WorkspaceLeaf = app.workspace.activeLeaf
                                                            const menu = new Menu(app);
                                                            menu.addItem(item => {
                                                                item.setIcon('vertical-split');
                                                                item.setTitle("Open in new pane");
                                                                item.onClick(async evt => {
                                                                    openFile(app, eachFile, leaf, true, true);
                                                                })
                                                            })
                                                            menu.addSeparator();
                                                            app.workspace.trigger(
                                                                'file-menu',
                                                                menu,
                                                                eachFile,
                                                                'link-context-menu',
                                                            );
                                                            menu.showAtPosition({ x: event.clientX, y: event.clientY });
                                                        });

                                                        //Navigate to the file... open in new pane with ctrl + click
                                                        eachValLink.addEventListener('click', (event: MouseEvent) => {
                                                            let leaf: WorkspaceLeaf = app.workspace.activeLeaf
                                                            let newLeaf: boolean = false;
                                                            if (event.ctrlKey || event.metaKey) { newLeaf = true }
                                                            openFile(app, eachFile, leaf, newLeaf, true);
                                                        });
                                                    } else {
                                                        //NOT A MATCH BUT LIST UNDER "OTHER"
                                                        otherArr.push([eachKey, eachValue, eachFile]);
                                                    }
                                                }
                                            })
                                        }
                                    }
                                }
                            })
                        } else {
                            //Skip as duplicate value. Probably one of the artificially created date created or modified
                        }
                    })
                }
            }
            //console.log(otherArr);
        })
    }
}

function isViewActive(app: App, yamlLeaf: WorkspaceLeaf = app.workspace.getLeavesOfType(VIEW_TYPE)[0]) {
    //Only re-create the view if it is currently open/active in view of user
    if (yamlLeaf) {
        if (yamlLeaf.height === 0) {
            //console.log('not currently active');
            return false;
        } else {
            //console.log('ACTIVE');
            return true;
        }
    } else {
        return false;
    }
}

function showView(app: App) {
    //console.log('showView()')
    let yamlLeaf: WorkspaceLeaf = app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    app.workspace.revealLeaf(yamlLeaf);
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
					//console.log('Secret: ' + value);
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
        return "dot-network";
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

function openFile(app: App, targFile: TFile, targLeaf: WorkspaceLeaf, newPane: boolean, makeActive: boolean) {
    if (newPane) { targLeaf = app.workspace.splitActiveLeaf(); }
    targLeaf.openFile(targFile, { active: makeActive });
}