!function(parser){
	if(typeof define == "function" && define.amd) {
		define(["sactory"], parser);
	} else {
		Sactory.dom = parser(Sactory);
	}
}(function(Sactory){

	var DEFAULTS = ["", true, true, undefined, true, ""];

	var NONE = Sactory.Const.BUILDER_TYPE_NONE;
	var PROP = Sactory.Const.BUILDER_TYPE_PROP;
	var CONCAT = Sactory.Const.BUILDER_TYPE_CONCAT;
	var ON = Sactory.Const.BUILDER_TYPE_ON;
	var WIDGET = Sactory.Const.BUILDER_TYPE_WIDGET
	var E_WIDGET = Sactory.Const.BUILDER_TYPE_E_WIDGET;
	var SCT = 9;

	var TYPES = [];
	TYPES[NONE] = ':';
	TYPES[PROP] = '@';
	TYPES[CONCAT] = '~';
	TYPES[ON] = '+';
	TYPES[WIDGET] = '$';
	TYPES[SCT] = '*';

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
	
	function parseElement(node, data, callbacks) {
		var attributes = [];
		var wattributes = [];
		var forms = [];
		var callback = false;
		Array.prototype.slice.call(node.attributes, 0).forEach(function(attr){
			var name = attr.name;
			var optional = attr.name.charAt(0) == "?";
			var type = TYPES.indexOf(name.charAt(+optional));
			if(type != -1) {
				node.removeAttribute(name);
				var oname = name = name.substr(1 + optional);
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
						name = name.substring(0, start) + set(name.substr(start + closing.length, length)) + name.substr(start + length + closing.length * 2);
					} else {
						throw new Error("Closing brackets not found in expression '" + name + "'.");
					}
				}
				var value = attr.value.length ? (Object.prototype.hasOwnProperty.call(data, attr.value) ? data[attr.value] : parseValue(attr.value)) : DEFAULTS[type];
				if(type == SCT) {
					var column = name.indexOf(":");
					var type = column == -1 ? name : name.substring(0, column);
					var info = column == -1 ? "" : name.substr(column);
					switch(type) {
						case "next":
							attributes.push([value + Sactory.nextId(), NONE, info.substr(1)]);
							break;
						case "prev":
							attributes.push([value + Sactory.prevId(), NONE, info.substr(1)]);
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
							attributes.push([type, NONE, "type"]);
						case "form":
						case "value":
							forms.push([info, value, Object.prototype.hasOwnProperty.call(data, attr.value) ? function(value){
								data[attr.value] = value;
							} : function(){}]);
							break;
						default:
							throw new Error("Unknown attribute '*" + oname + "'.");
					}
				} else {
					var a = attributes;
					if(type == WIDGET) {
						if(name.charAt(0) == "$") {
							name = name.substr(1);
							type = E_WIDGET;
						} else {
							a = wattributes;
						}
					}
					a.push([value, type, name, optional]);
					if(type == ON && name.substring(0, 6) == "parsed") {
						callback = true;
					}
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
		// add callback if needed
		if(callback) {
			callbacks.push(node);
		}
		// parse children
		Array.prototype.slice.call(node.childNodes, 0).forEach(function(child){
			if(child.nodeType == Node.ELEMENT_NODE) {
				parseElement(child, data, callbacks);
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
	
	function parse(node, data) {
		if(arguments.length <= 1) {
			data = node || {};
			node = document.documentElement;
		}
		Sactory.ready(function(){
			var callbacks = [];
			parseElement(node, reduce(data), callbacks);
			callbacks.forEach(function(element){
				element.__builder.dispatchEvent("parsed");
			});
		});
	}
	
	Sactory.ready(function(){
		// check auto-parse
		if(document.querySelector("script[src*='sactory-dom-parser'][src$='#autoload']")) {
			parse();
		}
	});
	
	return {
		parse: parse,
		version: "%version%"
	};
	
});
