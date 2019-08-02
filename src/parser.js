!function(parser){
	if(typeof define == "function" && define.amd) {
		define(["sactory", "exports"], parser);
	} else {
		parser(Sactory, Sactory.dom = {});
	}
}(function(Sactory, exports){

	var NONE = Sactory.Const.BUILDER_TYPE_NONE;
	var PROP = Sactory.Const.BUILDER_TYPE_PROP;
	var CONCAT = Sactory.Const.BUILDER_TYPE_CONCAT;
	var ON = Sactory.Const.BUILDER_TYPE_ON;
	var WIDGET = Sactory.Const.BUILDER_TYPE_WIDGET
	var E_WIDGET = Sactory.Const.BUILDER_TYPE_EXTEND_WIDGET;
	var SCT = 8;
	var CT = 9;

	var DEFAULTS = [];
	DEFAULTS[PROP] = true;
	DEFAULTS[CONCAT] = true;
	DEFAULTS[ON] = null;
	DEFAULTS[WIDGET] = true;

	var TYPES = [];
	TYPES[PROP] = '@';
	TYPES[CONCAT] = '~';
	TYPES[ON] = '+';
	TYPES[WIDGET] = '$';
	TYPES[SCT] = '*';
	TYPES[CT] = ':';

	function parseName(name, data) {
		var start = name.indexOf("[");
		if(start != -1) {
			var closing, set;
			if(name.charAt(start + 1) == "[") {
				closing = "]]";
				set = function(key){
					return Sactory.config.shortcut[key];
				};
			} else {
				closing = "]";
				set = function(key){
					return data[key];
				};
			}
			var length = name.substr(start + closing.length).indexOf(closing);
			if(length != -1) {
				var before = name.substring(0, start);
				var value = set(name.substr(start + closing.length, length));
				var after = name.substr(start + length + closing.length * 2);
				return before.length || after.length ? before + value + after : value;
			} else {
				throw new Error("Closing brackets not found in expression '" + name + "'.");
			}
		} else {
			return name;
		}
	}

	function parseValue(value) {
		if(value == "true") {
			return true;
		} else if(value == "false") {
			return false;
		} else if(value.charAt(0) == "{" && value.charAt(value.length - 1) == "}") {
			eval("function ret()" + value);
			return ret;
		} else {
			var num = +value;
			return isNaN(num) ? value : num;
		}
	}
	
	function parseElement(node, data, ref, callbacks) {
		var attributes = [];
		var wattributes = [];
		var forms = [];
		var refElement, refWidget;
		var callback = false;
		Array.prototype.slice.call(node.attributes, 0).forEach(function(attr){
			var name = attr.name;
			var optional = attr.name.charAt(0) == "?";
			var type = TYPES.indexOf(name.charAt(+optional));
			switch(type) {
				case CT:
					node.removeAttribute(name);
					switch(name.substr(1 + optional)) {
						case "ref":
							refElement = attr.value;
							break;
						case "ref-widget":
							refWidget = attr.value;
							break;
					}
					break;
				case SCT:
					node.removeAttribute(name);
					var oname = name = name.substr(1 + optional);
					if(type == SCT) {
						var column = name.indexOf(":");
						var pre = column == -1 ? name : name.substring(0, column);
						var info = column == -1 ? "" : parseName(name.substr(column));
						switch(pre) {
							case "next":
								attributes.push([attr.value + Sactory.nextId(), NONE, info.substr(1)]);
								break;
							case "prev":
								attributes.push([attr.value + Sactory.prevId(), NONE, info.substr(1)]);
								break;
							case "number":
								info += ":number";
							case "checkbox":
							case "color":
							case "date":
							case "email":
							case "file":
							case "hidden":
							case "password":
							case "radio":
							case "range":
							case "text":
							case "time":
								attributes.push([pre, NONE, "type"]);
							case "form":
							case "value":
								var has = Object.prototype.hasOwnProperty.call(data, attr.value);
								forms.push([info, has ? data[attr.value] : parseValue(attr.value), has ? function(value){
									data[attr.value] = value;
								} : function(){}]);
								break;
							default:
								throw new Error("Unknown attribute '*" + oname + "'.");
						}
					}
					break;
				case -1:
					if(Object.prototype.hasOwnProperty.call(data, attr.value)) {
						node.removeAttribute(name);
						attributes.push([data[attr.value], NONE, attr.name, optional]);
					}
					break;
				default:
					node.removeAttribute(name);
					name = name.substr(1 + optional);
					var a = attributes;
					if(type == WIDGET) {
						if(name.charAt(0) == "$") {
							name = name.substr(1);
							type = E_WIDGET;
						} else {
							a = wattributes;
						}
					}
					name = parseName(name);
					a.push([attr.value.length ? (Object.prototype.hasOwnProperty.call(data, attr.value) ? data[attr.value] : parseValue(attr.value)) : DEFAULTS[type], type, name, optional]);
					if(type == ON && name.substring(0, 6) == "parsed") {
						callback = true;
					}
			}
		});
		var tagName = node.tagName.toLowerCase();
		var context = {scope: data};
		if(Sactory.hasWidget(tagName)) {
			// replace with widget
			Sactory.update(context, {tagName: tagName, 2: wattributes});
			// transfer attributes
			Array.prototype.slice.call(node.attributes, 0).forEach(function(attr){
				context.element.setAttribute(attr.name, attr.value);
			});
			// transfer children
			Array.prototype.slice.call(node.childNodes, 0).forEach(function(child){
				context.content.appendChild(child);
			});
			// replace
			node.parentNode.replaceChild(context.element, node);
			node = context.element;
		} else {
			context.element = context.content = node;
		}
		// apply attributes
		if(attributes.length) {
			Sactory.update(context, {2: attributes});
		}
		// apply forms
		if(forms.length) {
			forms.unshift(context);
			Sactory.forms.apply(null, forms);
		}
		// set refs
		if(refElement) {
			ref[refElement] = node;
		}
		if(refWidget) {
			ref[refWidget] = Sactory.widget(node);
		}
		// add callback if needed
		if(callback) {
			callbacks.push(node);
		}
		// parse children
		Array.prototype.slice.call(node.childNodes, 0).forEach(function(child){
			if(child.nodeType == Node.ELEMENT_NODE) {
				parseElement(child, data, ref, callbacks);
			} else if(child.nodeType == Node.TEXT_NODE) {
				parseText(child, data);
			}
		});
	}
	
	function parseText(node, data) {
		var text = node.textContent;
		var index = 0;
		var result = [];
		var observables = [];
		while(index < text.length) {
			var c = text.charAt(index);
			if(c == "$" && text.charAt(index + 1) == "{") {
				if(text.charAt(index - 1) == "\\") {
					text = text.substring(0, index - 1) + text.substr(index);
					index++; // skip next check
				} else {
					var length = text.substr(index + 2).indexOf("}");
					if(length == -1) {
						// never closed
						index++;
					} else {
						var key = text.substr(index + 2, length);
						if(Object.prototype.hasOwnProperty.call(data, key)) {
							var value = data[key];
							var pre = text.substring(0, index);
							if(pre.length) result.push(pre);
							result.push(value);
							text = text.substring(index + length + 3);
							index = 0;
							if(Sactory.isObservable(value)) {
								observables.push(value);
							}
						} else {
							index += length + 3;
						}
					}
				}
			} else {
				index++;
			}
		}
		if(text.length) result.push(text);
		node.textContent = result.join("");
		if(observables.length) {
			Sactory.computedObservable(null, null, observables, function(){
				return result.join("");
			}).subscribe(function(value){
				node.textContent = value;
			});
		}
	}
	
	function reduceImpl(keys, ret, obj) {
		for(var key in obj) {
			var value = obj[key];
			ret[keys.concat(key).join(".")] = value;
			if(value && value.constructor === Object) {
				reduceImpl(keys.concat(key), ret, value);
			}
		}
	}
	
	function reduce(obj) {
		var ret = {};
		reduceImpl([], ret, obj);
		return ret;
	}

	exports.ref = {};
	
	exports.parse = function(node, data) {
		var ref = {};
		if(arguments.length <= 1) {
			data = node || {};
			node = document.documentElement;
		}
		Sactory.ready(function(){
			var callbacks = [];
			parseElement(node, reduce(data), ref, callbacks);
			callbacks.forEach(function(element){
				element.__builder.dispatchEvent("parsed");
			});
			for(var key in ref) {
				exports.ref[key] = ref[key];
			}
		});
		return ref;
	};

	exports.parseHead = function(data){
		return exports.parse(document.head, data);
	};

	exports.parseBody = function(data){
		return exports.parse(document.body, data);
	};
	
	Sactory.ready(function(){
		// check auto-parse
		if(document.querySelector("script[src*='sactory-dom-parser'][src$='#autoload']")) {
			exports.parse();
		}
	});

	Object.defineProperty(exports, "version", {
		value: "%version%"
	});
	
});
