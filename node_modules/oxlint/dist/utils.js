const { prototype: ObjectPrototype, hasOwn: ObjectHasOwn, keys: ObjectKeys, values: ObjectValues, freeze: ObjectFreeze, defineProperty: ObjectDefineProperty, defineProperties: ObjectDefineProperties, create: ObjectCreate, assign: ObjectAssign, getPrototypeOf: ObjectGetPrototypeOf, setPrototypeOf: ObjectSetPrototypeOf, entries: ObjectEntries } = Object, { prototype: ArrayPrototype, isArray: ArrayIsArray, from: ArrayFrom } = Array, { min: MathMin, max: MathMax, floor: MathFloor } = Math, { parse: JSONParse, stringify: JSONStringify } = JSON, { ownKeys: ReflectOwnKeys } = Reflect, { iterator: SymbolIterator } = Symbol;
function getErrorMessage(err) {
	try {
		if (err instanceof Error) {
			let { stack } = err;
			if (typeof stack == "string" && stack !== "") return stack;
		}
		let { message } = err;
		if (typeof message == "string" && message !== "") return message;
	} catch {}
	return "Unknown error";
}
export { SymbolIterator as _, JSONStringify as a, ObjectAssign as c, ObjectEntries as d, ObjectFreeze as f, ObjectValues as g, ObjectPrototype as h, JSONParse as i, ObjectCreate as l, ObjectKeys as m, ArrayFrom as n, MathMax as o, ObjectHasOwn as p, ArrayIsArray as r, MathMin as s, getErrorMessage as t, ObjectDefineProperty as u };
