import { n as isDefineConfig } from "./config.js";
import { a as JSONStringify, r as ArrayIsArray, t as getErrorMessage } from "./utils.js";
function validateConfigExtends(root) {
	let visited = /* @__PURE__ */ new WeakSet(), inStack = /* @__PURE__ */ new WeakSet(), stackObjects = [], stackPaths = [], formatCycleError = (refPath, cycleStart, idx) => `\`extends\` contains a circular reference.

${refPath} points back to ${cycleStart}\nCycle: ${idx === -1 ? `${cycleStart} -> ${cycleStart}` : [...stackPaths.slice(idx), cycleStart].join(" -> ")}`, visit = (config, path) => {
		if (visited.has(config)) return;
		if (inStack.has(config)) {
			let idx = stackObjects.indexOf(config), cycleStart = idx === -1 ? "<unknown>" : stackPaths[idx];
			throw Error(formatCycleError(path, cycleStart, idx));
		}
		inStack.add(config), stackObjects.push(config), stackPaths.push(path);
		let maybeExtends = config.extends;
		if (maybeExtends !== void 0) {
			if (!ArrayIsArray(maybeExtends)) throw Error("`extends` must be an array of config objects (strings/paths are not supported).");
			for (let i = 0; i < maybeExtends.length; i++) {
				let item = maybeExtends[i];
				if (typeof item != "object" || !item || ArrayIsArray(item)) throw Error(`\`extends[${i}]\` must be a config object (strings/paths are not supported).`);
				let itemPath = `${path}.extends[${i}]`;
				if (inStack.has(item)) {
					let idx = stackObjects.indexOf(item), cycleStart = idx === -1 ? "<unknown>" : stackPaths[idx];
					throw Error(formatCycleError(itemPath, cycleStart, idx));
				}
				visit(item, itemPath);
			}
		}
		inStack.delete(config), stackObjects.pop(), stackPaths.pop(), visited.add(config);
	};
	visit(root, "<root>");
}
async function loadJsConfigs(paths) {
	try {
		let results = await Promise.allSettled(paths.map(async (path) => {
			let config = (await import(new URL(`file://${path}`).href)).default;
			if (config === void 0) throw Error("Configuration file has no default export.");
			if (typeof config != "object" || !config || ArrayIsArray(config)) throw Error("Configuration file must have a default export that is an object.");
			if (!isDefineConfig(config)) throw Error("Configuration file must wrap its default export with defineConfig() from \"oxlint\".");
			return validateConfigExtends(config), {
				path,
				config
			};
		})), successes = [], errors = [];
		for (let i = 0; i < results.length; i++) {
			let result = results[i];
			result.status === "fulfilled" ? successes.push(result.value) : errors.push({
				path: paths[i],
				error: getErrorMessage(result.reason)
			});
		}
		return errors.length > 0 ? JSONStringify({ Failures: errors }) : JSONStringify({ Success: successes });
	} catch (err) {
		return JSONStringify({ Error: getErrorMessage(err) });
	}
}
export { loadJsConfigs };
