!function(parser){
	if(typeof define == "function" && define.amd) {
		define(["sactory"], parser);
	} else {
		Sactory.dom = parser(Sactory);
	}
}(function(Sactory){

	function parseValue(value) {
		if(value.length == 0 || value == "true") {
			return true;
		} else if(value == "false") {
			return false;
		} else {
			var num = +value;
			return isNaN(num) ? value : num;
		}
	}
	
	function parseElement(node, data, callbacks) {
		var attributes = [];
		var wattributes = [];
		var forms = [];
		var newCallbacks = [];
		Array.prototype.slice.call(node.attributes, 0).forEach(function(attr){
			var name = attr.name;
			var type = [':', '@', '~', '+', '$', '*'].indexOf(name.charAt(0));
			if(type != -1) {
				node.removeAttribute(name);
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
				var value = Object.prototype.hasOwnProperty.call(data, attr.value) ? data[attr.value] : parseValue(attr.value);
				if(type == 5) {
					var oname = name = name.substr(1);
					var column = name.indexOf(":");
					var type = column == -1 ? name : name.substring(0, column);
					var info = column == -1 ? "" : name.substr(column);
					switch(type) {
						case "next":
							attributes.push([attr.value + Sactory.nextId(), 0, info.substr(1)]);
							break;
						case "prev":
							attributes.push([attr.value + Sactory.prevId(), 0, info.substr(1)]);
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
							attributes.push([type, 0, "type"]);
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
					name = name.substr(1);
					var a = attributes;
					if(type == 4) {
						if(name.charAt(0) == "$") {
							name = name.substr(1);
							type = 5;
						} else {
							a = wattributes;
						}
					}
					a.push([value, type, name]);
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
		// add new callbacks to list of callbacks
		newCallbacks.forEach(function(callback){
			callbacks.push({
				element: node,
				listener: callback
			});
		});
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
			callbacks.forEach(function(callback){
				callback.listener.call(callback.element, {});
			});
		});
	}
	
	Sactory.ready(function(){
		// check auto-parse
		var scripts = Array.prototype.slice.call(document.querySelectorAll("script[src]"), 0);
		for(var i in scripts) {
			var script = scripts[i];
			if(script.src.indexOf("/sactory-dom-parser.") != -1 && script.src.slice(-9) == "#autoload") {
				parse();
				return;
			}
		}
	});
	
	return {
		parse: parse,
		version: "%version%"
	};
	
});
