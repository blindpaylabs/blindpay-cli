import { r as lint } from "./bindings.js";
let loadPlugin = null, setupRuleConfigs = null, lintFile = null, createWorkspace = null, destroyWorkspace = null, loadJsConfigs = null;
function loadPluginWrapper(path, pluginName, pluginNameIsAlias, workspaceUri) {
	return loadPlugin === null ? import("./plugins.js").then((mod) => ({loadPlugin, lintFile, setupRuleConfigs} = mod, loadPlugin(path, pluginName, pluginNameIsAlias, workspaceUri))) : loadPlugin(path, pluginName, pluginNameIsAlias, workspaceUri);
}
function setupRuleConfigsWrapper(optionsJSON) {
	return setupRuleConfigs(optionsJSON);
}
function lintFileWrapper(filePath, bufferId, buffer, ruleIds, optionsIds, settingsJSON, globalsJSON, workspaceUri) {
	return lintFile(filePath, bufferId, buffer, ruleIds, optionsIds, settingsJSON, globalsJSON, workspaceUri);
}
function createWorkspaceWrapper(workspace) {
	return createWorkspace === null ? import("./workspace.js").then((mod) => ({createWorkspace, destroyWorkspace} = mod, createWorkspace(workspace))) : Promise.resolve(createWorkspace(workspace));
}
function destroyWorkspaceWrapper(workspace) {
	destroyWorkspace(workspace);
}
function loadJsConfigsWrapper(paths) {
	return loadJsConfigs === null ? import("./js_config.js").then((mod) => (loadJsConfigs = mod.loadJsConfigs, loadJsConfigs(paths))) : loadJsConfigs(paths);
}
const args = process.argv.slice(2);
process.stdout.isTTY || (process.stdin._handle?.setBlocking?.(!0), process.stdout._handle?.setBlocking?.(!0)), await lint(args, loadPluginWrapper, setupRuleConfigsWrapper, lintFileWrapper, createWorkspaceWrapper, destroyWorkspaceWrapper, loadJsConfigsWrapper) || (process.exitCode = 1);
export {};
