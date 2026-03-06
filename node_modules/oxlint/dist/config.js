const DEFINE_CONFIG_REGISTRY = /* @__PURE__ */ new WeakSet();
function defineConfig(config) {
	return DEFINE_CONFIG_REGISTRY.add(config), config;
}
function isDefineConfig(config) {
	return typeof config == "object" && !!config && DEFINE_CONFIG_REGISTRY.has(config);
}
export { isDefineConfig as n, defineConfig as t };
