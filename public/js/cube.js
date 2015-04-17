/**
 * cube - computable document format.
 * Copyright (c) 2014, Benjamin Norrington
 */

;(function(base){


function replace(regex, opt) {
	regex = regex.source;
	opt = opt || '';
	return function self(name, val) {
		if (!name) return new RegExp(regex, opt);
		val = val.source || val;
		val = val.replace(/(^|[^\[\\])\^/g, '$1');
		regex = regex.replace(name, val);
		return self;
	};
}

function escapeRegExp(str) {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

var keywords = ['In', 'Skip']; //, 'Using', 'As']; //probably don't need any keywords
var operators = [
	'...', '..', '.', '->', '*', '/', '+', '-', '==',
	'!=', '<>', '!', '^', '?', '%', '@', '##', '#', '=', '&&', '||', '&',
	'|', '>>', '<<', '<=', '>=', '<', '>',':'
]; //TODO move the lexer after the parser and generate these
var blanks = ['___', '__', '_.', '_'];
var brackets = ['[', ']', '(', ')', '{', '}'];
var code = {
	continuation: /^\n[ \t]+/, //indent a line to continue the previous line
	newline: /^(?:\r\n|\n)+/,
	whitespace: /^[^\S\n\r]+/,
	//symbol cannot contain a number unless quoted (assume the inital space has been gobbled)
	symbol: /^(?: *(?!keywords)[^ special0-9]+)+/, 
	quoted: /^`(?:[^`]|``)+`/, //quoted symbol cannot be empty
	string: /^"(?:[^"]|"")*"/,
	number: /^(?:0x[0-9A-F]+|\d*\.?\d+([Ee][+-]?\d+)?)%?/,
	comment: /^\/\/[^\r\n]*/,
	comma: /^,/
};
code._special = escapeRegExp('&#@:[]{}()+.~",*%!^|;<>?\\/=-_') + '\n\r\t';
code._keywords = '(?:' + keywords.join('|') + ')\\b';

code.keyword = new RegExp('^' + code._keywords, 'i');
code.operator = new RegExp('^(?:' + operators.map(escapeRegExp).join('|') + '|\\\\\\w+)');
code.blank = new RegExp('^(?:' + blanks.map(escapeRegExp).join('|') + ')');
code.bracket = new RegExp('^(?:' + brackets.map(escapeRegExp).join('|') + ')');

code.symbol = replace(code.symbol, 'i')
(/keywords/g, code._keywords)
(/special/g, code._special)
();


var lex = function(src) {
	var tokens = [];
	var cap;

	src += '\n\n'; // add a newline to src to simplify
	while (src) {
		//gobble whitespace (except newline)
		if ((cap = code.whitespace.exec(src))) {
			//tokens.push("space"); //ignore space
			src = src.substring(cap[0].length);
		}

		//gobble a comment to the end of the line
		if ((cap = code.comment.exec(src))) {
			src = src.substring(cap[0].length);
			continue;
		}

		//gobble a newline followed by an indent
		if ((cap = code.continuation.exec(src))) {
			//tokens.push("space"); //ignore space
			src = src.substring(cap[0].length);
			continue;
		}

		if ((cap = code.newline.exec(src))) {
			tokens.push({
				type: "EOL",
				value: cap[0]
			});
			src = src.substring(cap[0].length);
			continue;
		}

		if ((cap = code.string.exec(src))) {
			src = src.substring(cap[0].length);
			tokens.push({
				type: "string",
				value: cap[0].slice(1, -1).replace(/""/, '"')
			});
			continue;
		}

		if ((cap = code.quoted.exec(src))) {
			src = src.substring(cap[0].length);
			tokens.push({
				type: "symbol",
				value: cap[0].slice(1, -1).replace(/``/, '`')
			});
			continue;
		}

		if ((cap = code.symbol.exec(src))) {
			src = src.substring(cap[0].length);
			tokens.push({
				type: "symbol",
				value: cap[0]
			});
			continue;
		}

		if ((cap = code.keyword.exec(src))) {
			src = src.substring(cap[0].length);
			tokens.push({
				type: "operator", //keyword
				value: cap[0].toUpperCase()
			});
			continue;
		}

		if ((cap = code.bracket.exec(src))) {
			src = src.substring(cap[0].length);
			tokens.push({type:"bracket", value:cap[0]});
			continue;
		}
		
		if ((cap = code.blank.exec(src))) {
			src = src.substring(cap[0].length);
			tokens.push({type:"blank", value:cap[0]});
			continue;
		}
		
		if ((cap = code.comma.exec(src))) {
			src = src.substring(cap[0].length);
			tokens.push({
				type: "comma",
				value: cap[0]
			});
			continue;
		}

		if ((cap = code.operator.exec(src))) {
			src = src.substring(cap[0].length);
			tokens.push({
				type: "operator",
				value: cap[0]
			});
			continue;
		}

		if ((cap = code.number.exec(src))) {
			src = src.substring(cap[0].length);
			if (cap[0][cap[0].length - 1] === '%')
				tokens.push({
					type: "number",
					value: (Number(cap[0].slice(0, -1)) / 100.0)
				});
			else
				tokens.push({
					type: "number",
					value: Number(cap[0])
				});
			continue;
		}

		if (src) {
			console.log(tokens);
			throw new Error('Syntax error: ' + src);
		}
	}
	return tokens;
};


function hashOf() {
	var ret = {};
	for (var i = arguments.length - 1; i >= 0; i--) {
		var k = arguments[i];
		ret[k] = k;
	}
	return ret;
}

//everything that can go in the head of a Cons
var heads = hashOf('Apply',
	'Set',
	'List',
	'Slice',
	'Optional',
	'Pattern',
	'Let',
	'Call' //deprecated
	);

/* M-Expr Parser */
var prefixes = {};
var postfixes = {};
var infixes = {};
var flat = 'flat';
var right = 'right';
var left = 'left';

var infix = function(pattern, name, prec, assoc) {
	if (!heads.hasOwnProperty(name)) heads[name] = name;
	infixes[pattern] = {
		'name': heads[name],
		'prec': prec,
		'assoc': assoc
	};
};

var prefix = function(pattern, name, prec) {
	if (!heads.hasOwnProperty(name)) heads[name] = name;
	prefixes[pattern] = {
		'name': heads[name],
		'prec': prec
	};
};

var postfix = function(pattern, name, prec) {
	if (!heads.hasOwnProperty(name)) heads[name] = name;
	postfixes[pattern] = {
		'name': heads[name],
		'prec': prec
	};
};

//TODO add function that takes the argument and returns the {head: ... , tail: ....} object
//  left, flat, right probably also make a difference to this function

//matchfix {x,y,z}
//compound x/:y=z
//overfix x\hat OverHat[x]

//forms containing #
//forms containing %
//forms containing _

//\& Overscript, right
//\+ Underscript right
//\+ \% Underoverscript
//\& \% Underoverscript

infix('.', '.', 7500, flat);

//Type specifier
infix(':','Type', 7450, right);

infix('_', 'Subscript', 7400, right);
//\_ \% Power[Subscript]

prefix('?', 'Help', 7300)
infix('?', 'PatternTest', 7300, flat);

var applyPrec = 7200;
//f[e]
//f[[e]]

//e++
//e--

//++e
//--e

//e1@e2,'e1[e2]',6900,right

//e1~e2~e3, 'e2[e1,e3]',6800,left

prefix('#', 'Index', 7200); //index of dimension
infix('#', 'IndexOf', 7100); //index of element in dimension
prefix('##', 'Count', 6900); //can probably use @ for index

//prefix('@', 'Name', 6800); //Don't really need this

//infix('/@', 'Map', 6700, right);
//infix('//@', 'MapAll', 6700, right);
//infix('@@', 'Apply', 6700, right);
//infix('@@@','Apply',6700,right) //Apply[e1,e2,{1}]

postfix('!', 'Factorial', 6600);
postfix('!!', 'Factorial2', 6600);

//postfix('^T','Transpose',6500);
postfix('^*', 'Conjugate', 6500);
//ConjugateTranspose

//postfix("'",'Derivative',6400) //Derivative[1][e]
//postfix("'''",...) //Derivative[n][e]

infix('<>', 'StringJoin', 6300, flat);

infix('^', 'Power', 6200, right);

//virt arrows
//sqrt
//integrate 5900
//??
//square,smallcircle
//infix('','CircleDot', 5600, flat)
//infix('**','NonCommutativeMultiply', 5500, flat);
//Cross
//Dot


prefix('-', 'Neg', 5200); //PreMinus
prefix('+', 'Noop', 5200);

infix('/', 'Divide', 5100, left);
infix('%', 'Mod', 5100, left);
infix('\u00f7', 'Divide', 5100, left);

//6 others

infix('*', 'Times', 4400, flat);
infix('\u00d7', 'Times', 4400, flat);

//6 others

infix('+', 'Plus', 3700, flat);
infix('-', 'Subtract', 3700, left);

//intersection
//union
//span

infix('...','RangeEx',3100,flat);
infix('..','Range',3100,flat);

infix('IN', 'In', 3050, right);

infix('==', 'Equal', 3000, flat);
infix('!=', 'Unequal', 3000, flat);
infix('\u2260', 'Unequal', 3000, flat);
infix('>', 'Greater', 3000, flat);
infix('>=', 'GreaterEqual', 3000, flat);
infix('\u2265', 'GreaterEqual', 3000, flat);
infix('<', 'Less', 3000, flat);
infix('<=', 'LessEqual', 3000, flat);
infix('\u2264', 'LessEqual', 3000, flat);
//Note these all have a special form Inequality[a,Less,b.LessEqual,c]

infix('\u2208', 'Element', 2500, flat); // \in
infix('\u2209', 'NotElement', 2500, flat); // \notin
//subset
//superset

//forall

prefix('!', 'Not', 2300, right);
prefix('\u00ac', 'Not', 2300, right);

infix('&&', 'And', 2200, flat);
//wedge

//xor

infix('||', 'Or', 2000, flat);
//vee

postfix('%', 'Percentage', 1500); //TODO.. this is not working

infix('->', 'Rule', 1100, right);

//replaceAll

// //

infix('=', 'Set', 300, right);

// >> Put //put to filename
// >>> PutAppend

var parse = function(ts) { //,multi) {
	var tokens = ts.reverse();
	var token = tokens.pop();
	var inslice = false;
	var memo;
	var ast;

	function getToken() { 
		token = tokens.pop();
		return token;
	}

	function getOperator(val) {
		if (token.value != val) {
			throw new Error("'" + val + "' expected but got {" + token.type + "} " + token.value);
		}
		return getToken();
	}

	function getA(head) {
		return function() {
			var t = [head, token.value];
			getToken();
			return t;
		};
	}

	var getNumber = getA('Number');
	var getString = getA('String');
	var getSymbol = getA('Symbol'); // we use Symbol to distinguish from built ins (to maintain no keywords)
	
	function getListLike(head,sep) {
		return function() {
			var node = [head];
			getToken();
		
			if (token.type === 'bracket' && token.value === sep) {
				getToken();
				return node;
			}
			getArguments(node);
			getOperator(sep);
		
			return node;
		};
	}

	getList = getListLike('List','}');
	getSlice = getListLike('Slice',']');
	getBracket = getListLike('Bracket',')');
	
	function getArguments(node) {
		while (true) {
			node.push(parseOperators(parsePrimary(),0));
			if (token.type !== 'comma') {
				break;
			}
			getToken();
		}
	}

	var _blanks = {
		'_': 'Blank',
		'_.': 'Blank',
		'__': 'BlankSequence',
		'___': 'BlankNullSequence'
	};

	function getBlank(symb) {
		var type = token.value,
			optional = false,
			blnk = [_blanks[type]];
		getToken();
		if (type === '_.') {
			return ['Optional',(symb ? ['Pattern', symb, blnk] : blnk)];
		}
		if (token.type === 'symbol') {
			blnk.push(getSymbol());
		}
		return (symb ? ['Pattern',symb,blnk] : blnk);
	}

	function getDotted(symb) {
		getToken();
		var rhs = getSymbol();
		var temp = symb.slice(0);
		temp.push(rhs[1]);
		if (token.type === 'operator' && token.value === '.') {
			return getDotted(temp);
		}
		return temp;
	}

	function getFactor() {
		var temp;
		if (token.type === 'symbol') {
			temp = getSymbol();
			if (token.type === 'blank') {
				return getBlank(temp);
			} else if (token.type === 'operator' && token.value === '.') {
				return getDotted(temp);
			}
			return temp;
		}
		if (token.type === 'blank') {
			return getBlank(false);
		}
		if (token.type === 'number') {
			return getNumber(false);
		}
		if (token.type === 'string') {
			return getString();
		}
		if (token.type === 'bracket') {
			switch (token.value) {
				case '(':
					return getBracket();
					//getToken();
					//temp = parseOperators(parsePrimary(), 0);
					//getOperator(')');
					//return ['Bracket',temp]; //add bracket so we can merge the flat stuff.
				case '{':
					return getList();
					//case '"': return getString();
					//case '%': //something about Out
					//case '#': //something about Slot
				case '[':
					return getSlice();
			}
		}
		// throw error
		return;
	}

	function getFunction(head) {
		var ast = ['Slice', head];
		inslice = true;
		getToken();
		if (token.type === 'bracket' && token.value === ']') {
			getToken();
			inslice = false;
			return parseArguments(ast); //we might be called again
		}
		getArguments(ast);
		getOperator(']'); //expect ']'
		inslice = false;
		return parseArguments(ast); //we might be called again
	}

	function getFunctionCall(head) {
		var ast = [heads.Call, head];
		getToken();
		if (token.type === 'bracket' && token.value === ')') {
			getToken();
			return parseArguments(ast); //we might be called again
		}
		getArguments(ast);
		getOperator(')'); //expect ']'
		return parseArguments(ast); //we might be called again
	}
	
	function parseArguments(lhs) {
		if (token.type === 'bracket' && token.value === '[')
			lhs = getFunction(lhs);
		if (token.type === 'bracket' && token.value === '(')
			lhs = getFunctionCall(lhs);
		return lhs;
	}
	
	function parseLookaheadOperator(min_prec) {
		var rhs = parsePrimary(), 
			lookahead = token;
		while (true) {
			if ((token.type === 'bracket' && (token.value === '{' || token.value === '(')) ||
				token.type === 'symbol' || token.type === 'number' || token.type === 'string') {
					// Juxtaposition means apply
					if (applyPrec >= min_prec) { // ||
					   //(applyPrec === min_prec && op.assoc === right)) {
						rhs = parseOperators(rhs, applyPrec);
						continue;
					}
					return rhs;
			} else {
				if (lookahead.type !== 'operator') {
					break;
				}
				if ((op = infixes[token.value])) {
					if (op.prec > min_prec || //This must be > and not >= for left assoc to work
					   (op.prec === min_prec && op.assoc === right)) {
						rhs = parseOperators(rhs,op.prec);
						continue;
					}
				} else if ((op = postfixes[token.value])) {
					if (op.prec > min_prec) {
						getToken();
						rhs = [op.name,rhs];
						continue;
					}
				}
			}
			break;
		}
		return rhs;
	}

	function parseOperators(lhs, min_prec) {
		var rhs = null, op;
		while (true) {
			if ((token.type === 'bracket' && (token.value === '{' || token.value === '(')) ||
				token.type === 'symbol' || token.type === 'number' || token.type === 'string') {
					// Juxtaposition means apply TODO: accept comma for multiple arguments
					if (applyPrec >= min_prec) {
						rhs = parseLookaheadOperator(applyPrec);
						lhs = parseArguments([lhs, rhs]);
						continue;
					}
					return lhs;
			} else {
				if (token.type !== 'operator') {
					//TODO handle special case for derivative
					break;
				}
				if ((op = infixes[token.value])) {
					if (op.prec >= min_prec) {
						getToken();
						rhs = parseLookaheadOperator(op.prec);
						if (inslice && op.name == 'Set')
							lhs = ['Let', lhs, rhs];
						else
							lhs = [op.name, lhs, rhs]; //{head:op.name, tail:[lhs,rhs]}; //TODO flat?
						lhs = parseArguments(lhs);
						continue;
					}
				} else if ((op = postfixes[token.value])) {
					if (op.prec >= min_prec) {
						getToken();
						lhs = [op.name,lhs]; //{head:op.name, tail:[lhs]};
						lhs = parseArguments(lhs);
						continue;
					}
				} else {
					throw new Error('Operator ' + token.value + ' is not infix or postfix.');
				}
				
			}
			break;
		}
		return lhs;
	}

	function parsePrimary() {
		var po, temp;
		if (token.type === 'operator') {
			//if (token.value === '.') // special parse a dot at the start of a number
			if ((po = prefixes[token.value])) {
				getToken();
				temp = parseLookaheadOperator(po.prec);
				//TODO do something special if Neg and temp is Number
				return [po.name, temp];
			}
		}
		return parseArguments(getFactor());
	}
	
	//if (multi) {
		ast = [];
		while (tokens.length > 0) {
			memo = parseOperators(parsePrimary(), 0);
			if (token.type !== 'EOL') {
				var err = [];
				while (tokens.length > 0 && token.type !== 'EOL') {
					err.push(token.type + ':' + token.value);
					getToken();
				}
				ast.push(['Error', 'Unexpected tokens before end of line', memo, err]);
			} else {
				ast.push(memo);
			}
			getToken();
		} 
	//} else {
	//	ast = parseOperators(parsePrimary(), 0);
	//	if (tokens.length > 0 && token.type !== 'EOL')
	//		throw new Error('End of line not reached. ' + tokens[0].type + ':' + tokens[0].value);
	//}
	return ast;
};

function head(node) {
	if (node instanceof Array) return node[0];
}


function normaliseHeadToPackage(node, basepackage) {
	var expr;
	var lhs;
	switch (head(node)) {
		case 'Set*':
		case 'Set': {
			var s = head(node);
			lhs = node[1];
			expr = node[2];
			if (head(lhs)==='Slice') {
				var guards = lhs.slice(0); //shallow copy
				guards[0] = 'Guards';
				guards[1] = expr;
				if (guards.length === 2) {
					//guards[2] = lhs[1]; //add self if this was an empty slice
					return normaliseHeadToPackage(['Category', lhs[1], expr], basepackage);
				} else {
					return normaliseHeadToPackage([s, lhs[1], guards], basepackage);
				}
			}
			if (head(lhs)==='Symbol' && lhs.length === 2)
				return [s, ['Symbol', basepackage, lhs[1]], expr];
			break;
		}
		case 'Category':
			lhs = node[1];
			expr = node[2];
			if (head(lhs)==='Symbol' && lhs.length === 2)
				return ['Category', ['Symbol', basepackage, lhs[1]], expr];
			break;
	}
	return node;
}

var MID = 1;


function Model(name, cells, namespace, seed, modified, dirty, id) {
	this._id = (id === undefined) ? MID++ : id; //unique id
	this.cells = cells || [];
	this.namespace = namespace || 'Main';
	this.name = name;
	this.seed = seed || 0;
	this.modified = !!modified;
	this._dirty = !!dirty;
	this.data = {}; //used to store linked data
	this.session = {}; //used to store session data
	//Note: if you add properties you need to update clone();
	//     and probably toJSON;

	if (cells && !seed) {
		var me = this;
		this.cells.forEach(function(cell, i) {
			cell.key = me.seed++; // need key before we initialise
			cell.initialise(undefined, me); //initialise will dirty *me* if needed
		});
	}
}

function sym() {
	var symb = ['Symbol'];
	Array.prototype.push.apply(symb, arguments);
	return symb;
}

function str(strn) {
	return ['String', strn];
}

function num(numb) {
	return ['Number', numb];
}


function numOrStr(nos) {
	var numb = +nos;
	if (isNaN(numb)) {
		return ['String', nos];
	}
	return ['Number', numb];
}

var _typeToConstructor = {
	header: Header,
	table: Table,
	p: P,
	figure: Figure,
	code: Code,
	ulli: Ulli,
	olli: Olli,
	quote: Quote,
	'break': Break,
};

//Usage: Model.fromObj(JSON.parse(str));
Model.fromObj = function(raw, namespace) {
	var obj = new Model();
	for(var i in raw)
		obj[i] = raw[i];
	obj.namespace = namespace || obj.name;
	//fixup cells
	obj.cells = obj.cells.map(function(cell) {
		var ncell = new (_typeToConstructor[cell.type])();
		for (var k in cell) {
			if (k !== 'type') ncell[k] = cell[k];
		}
		ncell.initFromObj(obj); //fixup object
		return ncell;
	});
	return obj;
};

Model.prototype.toJSON = function() {
	return {
		cells: this.cells,
		namespace: this.namespace,
		name: this.name,
		seed: this.seed,
		data: this.data,
	};
};

Model.prototype.cellByKey = function(key) {
	var ind = this.indexOfKey(key);
	if (ind >= 0) return this.cells[ind];
};

Model.prototype.indexOfKey = function(key) {
	var cells = this.cells;
	var len = cells.length;
	for (var i = 0; i < len; i++) {
		if (cells[i].key === key) return i;
	}
	return -1;
};

Model.prototype.offsetOfIndex = function(index) {
	var offset=0;
	var cells = this.cells;
	for (var i = 0; i < index; i++) {
		offset = offset + cells[i].raw.length;
	}
	return offset;
};

Model.prototype.cellForOffset = function(offset) {
	var cells = this.cells;
	var len = cells.length;
	var cell;
	var i;
	for (i = 0; i < len; i++) {
		cell = cells[i];
		if (cell.raw.length > offset) return {cell: cell, index: i, offset: offset};
		offset -= cell.raw.length;
	}
	if (offset === 0) offset = cells[len-1].raw.length || 1;
	return {cell: cells[len-1], index: len-1, offset: offset};
};

Model.prototype.toRaw = function() {
	return this.cells.map(function(cell, i) { return cell.raw; }).join('');
};

Model.prototype.clone = function() {
	var model = new Model(this.name, this.cells.slice(0),
		this.namespace, this.seed,  this.modified, this._dirty, this._id);
	model.data = this.data;
	return model;
};

Model.prototype.insertCell = function(cell, index, mutate) {
	var me = mutate ? this : this.clone();
	cell.key = me.seed++;
	cell.initialise(undefined, me);
	me.cells.splice(index,0,cell);
	me.modified = true;
	return me;
};

//update/replace
Model.prototype.updateCell = function(cell, index, mutate) {
	var me = mutate ? this : this.clone();
	cell.key = this.cells[index].key;
	cell.initialise(this.cells[index], me);
	me.cells[index] = cell;
	me.modified = true;
	return me;
};

Model.prototype.removeCell = function(index, mutate) {
	var me = mutate ? this : this.clone();
	me.modified = true;
	me.cells.splice(index,1);
	return me;
};

Model.prototype.merge = function(cells) {
	var me = this;
	var i = 0;
	var cell;
	var mutate = false;
	while (i < cells.length) {
		cell = cells[i];
		if (me.cells[i] && me.cells[i].raw === cell.raw) {
			//skip over identical cells
			i++;
			continue;
		}
		//different
		if (me.cells.length > cells.length) {
			me = me.removeCell(i, mutate);
			mutate = true;
			continue; //don't inc i
		}
		if (me.cells.length < cells.length) {
			me = me.insertCell(cell, i, mutate);
			mutate = true;
		} else {
			me = me.updateCell(cell, i, mutate);
			mutate = true;
		}
		i++;
	}
	while (i < me.cells.length) {
		me = me.removeCell(i, mutate);
		mutate = true;
	}
	return me;
};

//Cell types

function Cell() {}
Cell.prototype.toJSON = function() {
	var ret = {};
	for(var k in this) {
		if (k !== 'raw' && this.hasOwnProperty(k) && !(/^_/.test(k)))
			ret[k] = this[k];
	}
	ret.type = this.type;
	return ret;
};
Cell.prototype.initialise = function(old, model) {}; //override to do setup
Cell.prototype.initFromObj = function(model) {};
function Header() {}
Header.prototype = new Cell();
Header.prototype.type = 'header';
Header.prototype.initialise = function(old, model) {
	var raw = this.raw;
	this.level = /^#+/.exec(raw)[0].length;
	this.text = raw.slice(this.level);
};
Header.prototype.initFromObj = function(model) {
	this.raw = '########'.slice(0,this.level) + this.text;
};

function initFromObjSpan(starter) {
	return function(model) {
		if (this.spans.length > 0) {
			this.raw = starter + this.spans.map(function(span) {
				return span.text;
			}).join('');
		} else {
			this.raw = starter + '\n';
		}
	};
}

function P() {}
P.prototype = new Cell();
P.prototype.type = 'p';
P.prototype.initialise = function(old, model) {
	var raw = this.raw;
	this.spans = (raw.length > 0 && raw !== '\n' ? [{type: 'text', text: raw}] : []);
};
P.prototype.initFromObj = initFromObjSpan('');
function Figure() {}
Figure.prototype = new Cell();
Figure.prototype.type = 'figure';
Figure.prototype.initialise = function(old, model) {
	var sub = /^!\[([^\]]*)\]\(([^\)]*)\)(.*)/.exec(this.raw);
	this.alt = sub[1];
	this.src = sub[2];
	this.caption = sub[3];
};
Figure.prototype.initFromObj = function(model) {
	this.raw = '![' + this.alt + '](' + this.src + ')' + this.caption + '\n';
};
function Code() {}
Code.prototype = new Cell();
Code.prototype.type = 'code';
Code.prototype.initialise = function(old, model) {
	model._dirty = true;
	var raw = this.raw;
	this.lang = (/^ function +[$A-Za-z_][0-9A-Za-z_$]* *\(/.test(raw)) ? 'javascript' : 'cube';
	this.text = raw.slice(1).replace(/\n /g,'\n');
	this.parse(model);
};
Code.prototype.parse = function(model) {
	if (this.lang === 'cube') {
		try {
			this.tokens = lex(this.text);
			this.sexpr = parse(this.tokens)
				.map(function(node) { 
					return normaliseHeadToPackage(node, model.namespace); 
				});

		} catch (e) {
			this.error = e;
		}
	}
};
Code.prototype.initFromObj = function(model) {
	this.raw = ' ' + this.text.slice(0,-1).replace(/\n/g,'\n ') + '\n';
	this.parse(model);
};

function Ulli() {}
Ulli.prototype = new Cell();
Ulli.prototype.type = 'ulli';
Ulli.prototype.initialise = function(old, model) {
	this.spans = [{type: 'text', text: this.raw.slice(1)}];
};
Ulli.prototype.initFromObj = initFromObjSpan('*');

function Olli() {}
Olli.prototype = new Cell();
Olli.prototype.type = 'olli';
Olli.prototype.initialise = function(old, model) {
	this.spans = [{type: 'text', text: this.raw.slice(1)}];
};
Olli.prototype.initFromObj = initFromObjSpan('.');

function Quote() {}
Quote.prototype = new Cell();
Quote.prototype.type = 'quote';
Quote.prototype.initialise = function(old, model) {
	var r = this.raw.slice(1);
	this.spans = (r.length > 0 && r !== '\n' ? [{type: 'text', text: r}] : []);
};
Quote.prototype.initFromObj = initFromObjSpan('>');

function Break() {}
Break.prototype = new Cell();
Break.prototype.type = 'break';
Break.prototype.initFromObj = function(model) {
	this.raw = '-';
};

function Table() {}
//TODO: this needs a 
Table.prototype = new Cell();
Table.prototype.type = 'table';
Table.prototype.initialise = function(old, model) {
	var me = this;
	var raw = this.raw;
	var text = raw.slice(0,-1); //raw[raw.length-1] = '\n' ? raw.slice(0,-1) : raw;

	this.rows = text.split('\n').map(function(row,i) { 
		if (row.length === 0) return {key: i, cells:[]};
		return {key: i, cells:row.slice(1).split('|')}; //TODO: cache raw length
	});

	this.alignments = this.rows[0].cells.map(function(cell) {
	 	return /^ /.test(cell) ? 
	 		{'text-align': (/ $/.test(cell) ? 'center' : 'right')} : {};
	});

	this.classes = this.rows[0].cells.map(function(cell) {
	 	return /= *$/.test(cell) ? 'highlight' : undefined;
	});

	model._dirty = true; //TODO: only do this if we or old have code
	this.parse(model);
};
Table.prototype.parse = function(model) {
	var me = this;
	//check type (i.e row based, key based, with formulas)
	var modelColumns = [];
	var keys = {};
	var predicates = {};
	var cubeNames = {};
	var keyNames = [];
	var cubeColumns = [];
	var rows = this.rows;
	var header = rows[0].cells;
	header.forEach(function(cell, col) {
		var match = cell.match(/ *(.*)= *$/);
		if (match) {
			keys[col] = match[1];
			keyNames.push(match[1]);
			modelColumns.push(col);
		} else if ((match = cell.match(/^\s*(.*)\[([^\]]*)\] *$/))) {
			modelColumns.push(col);
			cubeColumns.push(col);
			predicates[col] = match[2];
			cubeNames[col] = match[1];
			//todo check for non row based predicate
		}
	});

	if (modelColumns.length > 0) {
		var formulaColumns = [];
		modelColumns.forEach(function(col) {
			var hasFormula = rows.some(function(row) {
				return /^ *=/.test(row.cells[col]);
			});
			if (hasFormula) formulaColumns.push(col);
		});
		var hasFormulas = formulaColumns.length > 0;
		
		var isRowBased = keyNames.length === 0;

		//Compile the table.
		//Don't support functions in key based columns if the
		//key is being defined by the table.

		//Don't support Row keyed tables with formulas.
		if (isRowBased && hasFormulas) {
			this.error = 'A Row keyed table column cannot contain formulas';
		} else if (isRowBased) {
			//assume all the predicates are the same (or only the first has anything in)
			var catName = predicates[cubeColumns[0]];
			
			this.sexpr = [
				//define Row category
				['Category', 
					sym(model.namespace, catName), //TODO. check for namespace
					['Call', sym('range'), num(this.rows.length - 1)]],
			];
			//define Cubes for cubeColumns
			cubeColumns.forEach(function(col) {
				var cubeName = cubeNames[col];
				var expr = ['Set', sym(model.namespace, cubeName), //TODO (check if we have a namespace on the column)
					['Indexed', ['Call', sym('_tableColumn'), ['Cube'], str(model.name), num(me.key), num(col)], 
					            ['Index', sym(catName)]]
				];
				me.sexpr.push(expr);
			});
		} else {
			//when we come to define the key (not here*) we need to
			// assert it doesn't have any formulas if we want the 
			// table to be where the key is defined
			//* wait until end to see if the key is defined outside
			// of the table so we don't attempt to define it twice.
			/*
			(Set (Symbol Main Description)
			     (LetG (Symbol Portfolio)
			     	   (Symbol Equity)
			     	   (String Equities)))
			 (Set (Symbol Main Weight)
			      (LetG (Symbol Portfolio) 
			            (Symbol Equity) 
			            (Number 0.6)))
			(Category (Symbol Main Portfolio) (List (Symbol Equity)))
			*/
			var body = rows.slice(1);
			var sexpr = this.sexpr = [];

			this.keyValues = {};
			for (var kcol in keys) {
				if (formulaColumns.indexOf(kcol) === -1) {
					var key = keys[kcol];
					var keyValues = this.keyValues[key] = {};
					body.forEach(function(row) {
						if (!keyValues[row.cells[kcol]]) {
							keyValues[row.cells[kcol]] = numOrStr(row.cells[kcol]);
						}
					});
				}
			}

			cubeColumns.forEach(function(col) {
				var cubeName = cubeNames[col].split('.');
				var cubeSym = (cubeName.length === 1) ? 
					sym(model.namespace, cubeName[0]) :
					sym.apply(this, cubeName);
				body.forEach(function(row) {
					//TODO: need to check if the column has predicates
					try {
						var mexpr = (row.cells[col] || '');
						var expr;
						if (/ *=/.test(mexpr)) {
							mexpr = mexpr.replace(/ *= */, '');
							expr = parse(lex(mexpr))[0];
						} else {
							expr = numOrStr(mexpr);
						}
						for (var kcol in keys) {
							var key = keys[kcol];
							expr = ['LetG', sym(key), numOrStr(row.cells[kcol]), expr];
						}
						sexpr.push(['Set', cubeSym, expr]);
					} catch (e) {
						me.error = e.toString();
					}
				});
			});
		}
	}
}
Table.prototype.initFromObj = function(model) {
	this.raw = this.rows.map(function(row) {
		return '|' + row.cells.join('|');
	}).join('\n') + '\n';
	this.parse(model);
};

function _tableColumn(cube, name, key, col) {
	//this should be
	//var cube = this._Cube;
	var model = cube.models[name];
	var cell = model.cellByKey(key);
	//assume table cell
	if (cell && cell.rows) {
		if (!cell._columns) cell._columns = {};
		if (!cell._columns[col]) {
			cell._columns[col] = cell.rows.slice(1).map(function(row) {
			var value = row.cells[col]; //TODO might want to convert to number if number
			var num = parseFloat(value);
			return (isNaN(num) ? value : num);
			});
		}
		return cell._columns[col];
	}
	return [];
}

var _constructors = {
	'#': Header,
	'p': P,
	'!': Figure,
	' ': Code,
	'*': Ulli,
	'.': Olli,
	'>': Quote,
	'-': Break,
	'|': Table,
};

//parse flat text representation of model into
//an array of cells.
function parseRaw(text) {
	var match;
	var obj;
	var textN = text;
	if (textN[textN.length-1] !== '\n') textN = textN + '\n';
	var paras = [];
	//       break|code                                |table                   |other
	var block = /-|(?: [^\n]*(?:\n }[^\n]*|\n  [^\n]*)*|\|(?:[^\n]|\n\||\n\n\|)*|[^\n]*)(?:\n)/g;

	while (block.lastIndex < textN.length && (match = block.exec(textN))) {
		var l = match[0];
		var capm = /^[\#\! \*\.\>\-\|]/.exec(l);
		var cap = capm ? capm[0] : 'p';
		if (cap === '!' && !(/^!\[([^\]]*)\]\(([^\)]*)\)(.*)/.test(l))) cap = 'p';
		else if (cap === '-' && l.length > 1) cap = 'p';
		var type = _constructors[cap];
		var obj = new type();
		obj.raw = l;
		paras.push(obj);
	}
	return paras;
}

function Cube() {
	this.models = {'#Scratch': new Model('#Scratch', parseRaw('#Scratch\nUse the scratchpad for your workings. This will not be saved!\n'))};
	this.names = [];
	this._packages = {};
	this._genSyms = {};
	this._genSymCount = {};
}


Cube.prototype.evaluate = function(code, namespace) {
	var tokens = lex(code);
	var sexpr = parse(tokens); //list of sexprs
	var me = this;
	namespace = namespace || this.baseModel().namespace;
	sexpr = this.preProcessSexprs(sexpr);
	var results = sexpr.map(function(expr) {
		expr._baseNamespace = namespace;
		expr.sourceNode = {};
		annotateDimensions(expr, 0, namespace, [], me._packages);
		expr = me.resolveExcessDimensions(expr, namespace);
		me.compileExpression(expr, namespace);
		return expr.compiled();
	});
	if (results.length === 1) return results[0];
	return results;
};

Cube.prototype.baseModel = function() {
	if (this.names.length >= 1)
		return this.models[this.names[0]];
	return this.models['#Scratch'];
};

Cube.prototype.dataCache = function() {
	return this.baseModel().data;
};

Cube.prototype.sessionCache = function() {
	return this.baseModel().session;
};

Cube.prototype.clearDataCache = function() {
	this.baseModel().data = {};
	this.baseModel().session = {};
};

Cube.prototype.toJSON = function() {
	var ret = [];
	for (var i=0; i < this.names.length; i++) {
		var model = this.models[this.names[i]];
		if (model.modified) {
			ret.push(model);
		}
	}
	return ret;
};

Cube.prototype.Symbol = function(val) {
	if (this._genSyms[val] !== undefined)
		return this._genSyms[val];
	var hint = camelCase(val);
	if (this._genSymCount.hasOwnProperty(hint)) {
		this._genSyms[val] = hint + '_' + this._genSymCount[hint];
		this._genSymCount[hint] += 1;
	} else {
		this._genSymCount[hint] = 1;
		this._genSyms[val] = hint;
	}
	return this._genSyms[val];
};

Cube.prototype.addModel = function(name, model) {
	this.names.push(name); //TODO: don't push names (import should be pushing here)
	this.models[name] = model;
	this.recalculate();
};

Cube.prototype.dirty = function() {
	var names = this.names;
	var len = names.length;
	var name;
	var model;
	for (var i = 0; i <= len; i++) {
		name = (i === len) ? '#Scratch' : names[i];
		model = this.models[name];
		if (model._dirty) return true;
	}
	return false;
};

function debounce(func, wait, immediate) {
    var timeout, args, context, timestamp, result;   
    var later = function() {
      var last = Date.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = Date.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }
      return result;
    };
};

Cube.prototype.recalcIfDirty = debounce(function() {
	if (this.dirty()) {
		this.recalculate();
		this.clean();
	}
}, 800);

Cube.prototype.clean = function() {
	for (var n in this.models) {
		if (this.models.hasOwnProperty(n)) {
			this.models[n]._dirty = false;
		}
	}
};

Cube.prototype.unmodify = function() {
	var ret = [];
	for (var n in this.models) {
		if (this.models.hasOwnProperty(n) && this.models[n].modified) {
			ret.push(n);
			this.models[n].modified = false;
		}
	}
	return ret;
};

Cube.prototype.remodify = function(names) {
	names.forEach(function(n) {
		this.models[n].modified = true;
	});
};

Cube.prototype.mergeModel = function(name, model) {
	this.models[name] = this.models[name].merge(model);	
	this.recalcIfDirty();
};

Cube.prototype.import = function(path, opt_as_namespace) {
	if (this._outstandingImports === undefined) this._outstandingImports = 0;
	var model = this.models[path];
	var me = this;
	if (!model) {
		//put a holding model in place to avoid double fetch
		var cells = [new Header()];
		cells[0].raw = '#' + path;
		model = new Model(path, cells, opt_as_namespace || path);
		me.models[path] = model;
		if (me.names.indexOf(path) == -1) me.names.push(path);
		//load model using import helper
		me._outstandingImports++;
		Cube.Import(path, function(err, model) {
			me._outstandingImports--;
			if (!model || err) {
				console.log(err);
				return;
			}
			me.models[path] = model; //replace with fetched model
			if (me._outstandingImports <= 0)
				me.recalculate();
			//if (me.onupdate) me.onupdate(path);
		});
	} else {
		if (opt_as_namespace && model.namespace !== opt_as_namespace) {
			model.namespace = opt_as_namespace;
		}
		//if not in names then add it.
		if (this.names.indexOf(path) == -1) this.names.push(path);
	}
};


//Compiler

//func takes non atom and path (e.g. expandMacros)
function transform(ast, func) {
	var ret = func.call(this, ast);
	if (ret === undefined) ret = [];
	for(var i=0; i<ret.length; i++) {
		var node = ret[i], node1;
		if (node instanceof Array) {
			node1 = transform.call(this, node, func);
			if (node !== node1) ret[i] = node1; //NOTE (in place edit)
		}
	}
	return ret;
}

function expandMacros(expr) {
	var rep;
	var sexpr;
	var symb = expr[1];

	if (expr[0] !== 'Call' || symb[0] !== 'Symbol')
		return expr;

	sexp = symb.slice(1).join('.').toUpperCase();

	var macro = Cube.Macros[sexp];
	if (!macro) return expr;

	rep = macro.apply(this, expr.slice(2));

	if (rep !== undefined) {
		rep.originalSexpr = expr.originalSexpr || expr;
		return rep;
	}

	return expr;
}

function expandPostMacros(expr) {
	var symb, rep;
	
	if (expr[0] !== 'PostMacro')
		throw new Exception('Cannot expand non post macro' + showS(expr));

	symb = expr[1];
	
	if (symb[0] !== 'Symbol' || symb.length !== 2) return expr;

	var macro = Cube.PostMacros[symb[1].toUpperCase()];
	if (!macro) return expr;

	rep = macro.apply(this, expr.slice(2));

	if (rep !== undefined) {
		rep.originalSexpr = expr.originalSexpr || expr;
		return rep;
	}

	return expr;
}

function expandSlice(expr) {
	var ret;

	function _slice(expr) {
		var ret = expr[1];
		var overs = ['Over', 0];
		for (var i = expr.length - 1; i >= 2; i--) {
			var para = expr[i];
			switch(para[0]) {
				case 'Let':
					ret = expandSlice(['LetS', para[1], para[2], ret]);
					break;
				case 'Symbol':
					overs.push(para);
					break;
				default:
					ret = ['Restrict', para, ret];
			}
		}
		//wrap over on the outside
		overs[1] = ret;
		return (overs.length > 2) ? overs : ret;
	}

	function _letS(expr) {
		//(LetS symb value expr) -> (LetS (Index symb) (IndexOf symb value) expr)
		if (expr[1][0] === 'Symbol')
		{
			var symb = expr[1];
			var value = expr[2];
			var exp = expr[3];
			return ['LetS', ['Index', symb], ['IndexOf', symb, value], exp];
		}
	}

	function _guards(expr) {
		var ret = expr[1];
		var overs = ['Indexed', 0];
		var i, para;
		for (i = expr.length - 1; i >= 2; i--) {
			para = expr[i];
			if (para[0] === 'Symbol')
				overs.push(['Index', para]);
		}
		//wrap indexed on the inside
		if (overs.length > 2) {
			overs[1] = ret;
			ret = overs;
		}
		for (i = expr.length - 1; i >= 2; i--) {
			para = expr[i];
			switch(para[0]) {
				case 'Let':
					ret = ['LetG', para[1], para[2], ret];
					break;
				case 'Symbol':
					break;
				default:
					ret = ['Restrict', para, ret];
			}
		}
		return ret;
	}

	switch(expr[0]) {
		case 'Slice': ret = _slice(expr); break;
		case 'LetS': ret = _letS(expr); break;
		case 'Guards': ret = _guards(expr); break;
	}
	if (ret !== undefined) {
		ret.originalSexpr = expr.originalSexpr || expr;
		return ret;
	}

	return expr;
}

function expandDict(expr) {
	var ret;
	if(expr[0] === 'List' && expr[1] &&
		(expr[1][0] === 'Set' || expr[1][0] === 'Rule')) {
		ret = ['Dict'];
		for (var i = 1; i < expr.length; i++) {
			var pair = expr[i];
			switch(pair[0]) {
				case 'Set':
				case 'Rule':
					ret.push(['Pair'].concat(pair.slice(1)));
					break;
				default:
					ret = ['Error', 'Dictionary entries must all be of the form a -> b or a = b'];
					ret.originalSexpr = expr.originalSexpr || expr;
					return ret;
			}
		}
		ret.originalSexpr = expr.originalSexpr || expr;
		expr = ret;
	}
	return expr;
}

var camelCase = function(name) {
	return (name
		.toLowerCase()
		.replace(/[^a-zA-Z]+([a-zA-Z]|$)/g,
			function(s,m) { return m.toUpperCase(); }));
};

var joinComma = function(items) { return Array.prototype.join.call(items, ','); };

//memoize assumes indirect recursion
function memoize(func, hasher) {
	hasher = (hasher !== undefined) ? hasher : joinComma;
	var memo = function() {
		var cache = memo.cache, args = hasher(arguments);
		if (cache[args] === undefined)
			cache[args] = memo.func.apply(this, arguments);
		return cache[args];
	};
	memo.func = func; //so we can replace the func
	memo.clearCache = function() { memo.cache = {}; };
	memo.cache = {};
	return memo;
}

//place to store dependedOn
function unmemoize(func) {
	var memo = function() {
		return memo.func.apply(this, arguments);
	};
	memo.func = func; //so we can replace the func
	memo.clearCache = function() { };
	return memo;
}

function indexed(func, athis) {
	var memo = function(i) {
		if (memo.cache === undefined)
			memo.cache = memo.func.apply(athis);
		return memo.cache[i];
	};
	memo.func = func; //so we can replace the function
	memo.clearCache = function() { memo.cache = undefined; };
	memo.cache = undefined;
	memo.len = function() { 
		if (memo.cache === undefined)
			memo(0);
		return memo.cache.length;
	};
	memo.forEach = function(f) {
		if (memo.cache === undefined)
			memo(0);
		memo.cache.forEach(f);
	};
	memo.indexOf = function(v)  {
		if (memo.cache === undefined)
			memo(0);
		return memo.cache.indexOf(v); //TODO: cache the index of
	};
	return memo;
}


Cube.prototype.compileOver = function(expr, basepack) {
	var me = this;
	var exp = this.compileExpr(expr[1], basepack);
	var dims = expr.dimensions.map(me.Symbol, me).join(', ');
	var retDims = expr.slice(2).map(function(e) { 
		return '"' + e.dimensions[0] + '"'; });
	var overs = expr.slice(2).map(function(e) { 
		var pack = e.dimensions[0].split('.',1)[0];
		var name = e.dimensions[0].slice(pack.length+1);
		return {pack: pack,
				name: name,
				sym: me.Symbol(e.dimensions[0]) ,
			};
		});

	var vars = '    var _k0m = 1';
	var ends = [];
	var starts = [];
	var indexes = [];
	overs.forEach(function(o, i) {
		var obj = 'env["' + o.pack + '"]["' + o.name + '"]';
		indexes.push('_k' + (i+1));
		vars = vars + ', _k' + (i+1) + ', _k' + (i+1) +
		'm = _k'+ i +'m * ' + obj +'.len()'; //.len must be defined on category
		starts.push(obj + '.forEach(function(v, ' + o.sym + ') {\n_k' + (i+1) + ' = _k' + i +'m * ' + o.sym + ';');
		ends.push('})');
	});
	//var t = dims.length	> 0 ? 'this, ' : 'this'
	var ov = '(function(' + dims + ') { var _ret=[], _val;\n' + vars + ';\n' +
	 starts.join('\n    ') +
	 '\n_val = '+exp+';\nif (_val !== undefined) _ret['+ indexes.join(' + ') +'] = _val;\n' +
	 ends.join('') +
	 ';\n_ret.dimensions = ['+ retDims.join(', ') +'];\nreturn _ret; \n}('+ dims + '))';
	return ov;
};

function quote(expr) {
	if (expr instanceof Array) {
		return '[' + expr.map(function(e) { return quote(e); }).join(', ') + ']';
	} 
	switch(typeof(expr)) {
		case 'string': return "'" + expr + "'";
		case 'number': return expr.toString();
		default: return expr.toString();
	}
}

function isFunction(symb) {
	var base = Cube.Functions;
	for (var i = 1; i < symb.length; i++) {
		var name = symb[i]
		if (base[name] === undefined) return false;
		base = base[name];
	}
	return true;
}

Cube.prototype.compileExpr = function(expr, basepack, context) {
	var me = this;
	var ex, pack, name;
	context = context || {};
	if (expr === undefined) return 0; //treat null as 0 (as per Spreadsheets)
	switch(expr[0]) {
		case 'PostMacro':
			return me.compileExpr(expandPostMacros(expr), basepack);
		case 'Category':
			return 'return (' + me.compileExpr(expr[2], basepack, context) + ');';
		case 'Func*':
		case 'Func':
			var exprs = expr.slice(2).map(function(e) {
				return '_ret = (' + me.compileExpr(e, basepack, context) + ');';
			});
			var ov = 'var _ret;\n' + 
				exprs.join('\nif(_ret !== undefined) return _ret;\n') +
				'\nreturn _ret;';
			return ov;
		case 'RemDims':
		case 'NoDim':
			return me.compileExpr(expr[1], basepack, context);
		case 'Cube':
			return 'env._Cube';
		case 'Cond':
			return '((' + me.compileExpr(expr[1], basepack, context) + ')' +
			       ' ? (' + me.compileExpr(expr[2], basepack, context) + ') : (' +
			       me.compileExpr(expr[3], basepack, context) + '))';
		case 'Quote':
			return quote(expr[1]);
		case 'LetG':
			return '('+ me.compileExpr(expr[1], basepack, context) +' == '+ me.compileExpr(expr[2], basepack, context)+') ? (' + me.compileExpr(expr[3], basepack, context) + ') : undefined';
		case 'LetS':
			//TODO: add range check as current code only checks start not end.
			return '(function(' + me.compileExpr(expr[1], basepack, context) + ') { \nreturn ('+ me.compileExpr(expr[1], basepack, context) +' >= 0) ? ('+ me.compileExpr(expr[3], basepack, context) +') : undefined; \n}('+me.compileExpr(expr[2], basepack, context)+'))';
		case 'Restrict':
			return '('+ me.compileExpr(expr[1], basepack, context) +') ? (' + me.compileExpr(expr[2], basepack, context) + ') : undefined';
		case 'Call':
			if (expr[1] && expr[1][0] === 'Symbol' && isFunction(expr[1])) {
				return 'env._Functions.' + expr[1].slice(1).join('.') + '(' +
					expr.slice(2).map(function(e) { return me.compileExpr(e, basepack, context); }).join(', ') + ')';
			} else {
				//TODO: probably want to make Symbol more sensible and have it 
				// just run this bit of code.
				return me.compileExpr(expr[1], basepack, context) + '(' +
					expr.slice(2).map(function(e) { return me.compileExpr(e, basepack, context); }).join(', ') + ')';
			}
		case 'Pair':
			return me.compileExpr(expr[1], basepack, context) + ':' + me.compileExpr(expr[2], basepack, context);
		case 'Dict':
			return '{' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(', ') + '}';
		case 'List':
			return '[' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(', ') + ']';
		case 'Times':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' * ') + ')';
		case 'Neg':
			return '(-(' + me.compileExpr(expr[1], basepack, context) + '))';
		case 'Plus':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' + ') + ')';
		case 'Subtract':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' - ') + ')';
		case 'Power':
			return 'Math.pow(' + me.compileExpr(expr[1], basepack, context) + ', ' + me.compileExpr(expr[2], basepack, context) + ')';
		case 'Bracket':
			return '(' + me.compileExpr(expr[1], basepack, context) + ')';
		case 'Divide':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' / ') + ')';
		case 'Mod':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' % ') + ')';
		case 'And':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' && ') + ')';
		case 'Or':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' || ') + ')';
		case 'Not':
			return '!(' + me.compileExpr(expr[1], basepack, context) + ')';
		case 'GreaterEqual':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' >= ') + ')';
		case 'Greater':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' > ') + ')';
		case 'Unequal':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' != ') + ')';
		case 'Equal':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' == ') + ')';
		case 'LessEqual':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' <= ') + ')';
		case 'Less':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack, context); }).join(' < ') + ')';
		case 'Indexed*':
			if (expr[1][0] !== 'List') throw new Error('Indexed* requires literal list');
			if (expr.length > 3) throw new Error('Indexed* does not yet support multiple args');
			return '(function() {\nswitch (' + 
				me.compileExpr(expr[2], basepack, context) + 
				') {\n' +
				expr[1].slice(1).map(function(e,i) { 
					return '  case ' + i +
					 ': return ' + me.compileExpr(e, basepack, context) + ';\n';
					}).join('') + '}; })()';
		case 'Indexed':
			//TODO: this needs optimizing
			if (expr.length > 3) throw new Error('Indexed does not yet support multiple args');
			ex = me.compileExpr(expr[1], basepack, context);
			return '(' + ex + ')[' + me.compileExpr(expr[2], basepack, context) + ']';
		case 'Index':
			if (!expr[1] || 
				!expr[1].dimensions || 
				expr[1].dimensions.length !== 1)
				throw new Error('Invalid index parameter ' + showS(expr));
			return me.Symbol(expr[1].dimensions[0]);
		case 'IndexOf':
			ex = me.compileExpr(expr[2], basepack, context);
			expr = expr[1];
			if (!expr.dimensions || expr.dimensions.length !== 1)
				throw new Error('Invalid indexOf parameter ' + showS(expr));
			//TODO: better store of dimensions as symbol
			pack = expr.dimensions[0].split('.',1)[0];
			name = expr.dimensions[0].slice(pack.length+1);
			return "env['" + pack + "']['" + name +"'].indexOf(" + ex + ")";
		case 'Over':
			return me.compileOver(expr, basepack);
		case 'Symbol':
			if (expr.length > 2) {
				pack = expr[1];
				name = expr[2];
			} else {
				name = expr[1];
				if (context[name]) return context[name];
				if (me._packages.hasOwnProperty(name))
					pack = name; //for Data tables
				else
					pack = basepack;
			}
			//if symbol defined (then annotateDimensions of definition)
			if (me._packages[pack] !== undefined && me._packages[pack].functions[name]) {
				var dims = me._packages[pack].functions[name].dimensions.map(me.Symbol, me);
				return "env['" + pack + "']['" + name +"'](" + dims.join(', ') + ")";
			}
			return '"' + expr.slice(1).join('.') + '"';
		case 'String':
			return '"' + expr[1].replace(/"/g, '\\"') + '"';
		case 'Number':
			return expr[1].toString();
		case 'Error':
			throw new Error(expr[1]);
		case 'Rule':
			if (expr[1] && expr[1][0] === 'Bracket') {
				var parameters = Object.create(context);
				makeParameters(expr[1].slice(1), parameters);
				var lambda = '(function('+ objValues(parameters).join(', ') +') { return (' + me.compileExpr(expr[2], basepack, parameters) + '); })'
				return lambda;
			}
			
		default:
			throw new Error('Compile Error: Not implemented for ' + showS(expr));
	}
};

//TODO: this might make conflicting symbols
// could just define that symbols are the same except for the characters
function makeParameters(list, ret) {
	list.forEach(function(s) {
		if (s === undefined) return;
		if (s[0] !== 'Symbol' || s.length > 2) throw new Error('Function parameters must be simple symbols');
		ret[s[1]] = '$' + s[1].replace(/[^a-zA-Z_\-]/g, '$'); 
	})
}

function objValues(obj) {
	var ret = [];
	for (var k in obj) {
		if (obj.hasOwnProperty(k)) ret.push(obj[k]);
	}
	return ret;
}

Cube.prototype._compileFunc = function(code, expr) {

    var func;
    var dims = expr.dimensions.map(this.Symbol, this);

    function _undefined() { return; }

    try {
        /*jshint evil:true */
        func = new Function(dims, code);
    } catch (er) {
        console.log('Could not compile: ' + code);
        console.log(er.message);
        func = _undefined;
    }
    switch(expr[0]) {
        case 'Category': return indexed(func, this._environment);
        case 'Func*':    return unmemoize(func);
        default:         return memoize(func);
    }
};

Cube.prototype.totalCells = function() {
	var me = this;
	var diml = {};
	function dimLength(di) {
		if (!diml.hasOwnProperty(di)) {
			var ds = di.split('.');
			var df = me._environment[ds[0]][ds[1]];
			try {
				diml[di] = df.len();
			} catch(e) {
				console.log(e.message);
				diml[di] = 1;
			}
						
		}
		return diml[di];
	}

	var total = 0;
	for (var n in this._environment) {
		if (/^_/.test(n)) continue; //skip '_Cube' etc
		var ns = this._environment[n];
		for (var fn in ns) {
			var f = ns[fn];
			if (!f.dimensions) continue;
			var prod = 1;
			f.dimensions.forEach(function(d) {
				prod *= dimLength(d);
			});
			console.log(n + ' : ' + fn + ' ... ' + f.dimensions.join(", ") + ' = ' + prod);
			total += prod;
		}
	}
	return total;
};

//Compile and bind expression
Cube.prototype.compileExpression = function(expr, basepack) {
	var env = this._environment[basepack];
	try {
		expr.func = this._compileFunc('var env = this; return (' + 
    		this.compileExpr(expr, basepack) + ');', expr);
		expr.compiled = expr.func.bind(env);
		expr.sourceNode.result = expr.compiled;
		expr.sourceNode.error = undefined;
	} catch(e) {
		console.log(e);
		expr.sourceNode.error = e.toString();
	}
	return expr;
};

Cube.prototype.compileFunc = function(expr, basepack) {
    return this._compileFunc(
    	'var env = this;' + 
    	this.compileExpr(expr, basepack), expr);
};

Cube.prototype.compileRule = function(expr, basepack) {
	throw "Unimplemented compileRule";
};


//Package is the ast representation of a Namespace
function Package(name) {
	this.name = name;
	this.dimensions = {};
	this.functions = {};
	this.expressions = {};
	this.unsatisfieds = {}; //dimensions that have no function
}

//func takes non atom and path
function visit(ast, func, path, index) {
	if (path === undefined) path = [];
	func(ast, path, index);
	path.push(ast[0]);
	for(var i=0; i<ast.length; i++) {
		var node = ast[i];
		if (node instanceof Array) {
			visit(node, func, path, i);
		}
	}
	path.pop();
}

//takes and returns array of sexpr
Cube.prototype.preProcessSexprs = function(sexprs) {
	var me = this;

	//expand macros
	var sexpr = [];
	sexprs.forEach(function(expr) {
		try {
			var nodes = transform.call(me, expr, expandMacros);
			if (nodes[0] === 'Do') {
				nodes = nodes.slice(1);
				Array.prototype.push.apply(sexpr, nodes.map(function(node) {
					return normaliseHeadToPackage(node, model.namespace);
				}));
			} else {
				sexpr.push(nodes);
			}
		} catch (e) {
			sexpr.push(['Error', e.message]);
		}
	});

	//map dictionary/associative array
	sexpr = sexpr.map(function(expr) {
		try {
			return transform.call(me, expr, expandDict);
		} catch(er) {
			return ['Error', 'Invalid dictionary content'];
		}
	});

	//expand slices
	sexpr = sexpr.map(function(expr) {
		try {
			return transform.call(me, expr, expandSlice);
		} catch(er) {
			return ['Error', 'Invalid slice content'];
		}
	});
	return sexpr;
};

function clearDimensions(expr) {
	if (expr === undefined) return;
	delete expr.pass;
	delete expr.dimensions;
	if (expr instanceof Array) {
		for(var i=expr.length - 1; i > 0; i--) clearDimensions(expr[i]);
	}
}

//annotate dimensions of functions
function annotateDimensions(expr, pass, basepack, hasChanged, packages) {
	if (typeof(expr) === 'string' || expr === undefined || expr === null)
		return [];
	if (expr.dimensions !== undefined) { 
		if (expr.pass === pass) {
			return expr.dimensions;
		}
	} else {
		expr.dimensions = [];
	}
	expr.pass = pass;

	function union(l,r) {
		var u = {};
		var ret = [];
		var i;
		for (i = l.length - 1; i >= 0; i--) {
			u[l[i]] = true;
		}
		for (i = r.length - 1; i >= 0; i--) {
			u[r[i]] = true;
		}
		for (var k in u) {
			if (u.hasOwnProperty(k))
				ret.push(k);
		}
		return ret;
	}

	function equal(l, r) {
		if (l.length !== r.length)
			return false;
		var u = {};
		var ret = [];
		var i;
		for (i = l.length - 1; i >= 0; i--) {
			u[l[i]] = true;
		}
		for (i = r.length - 1; i >= 0; i--) {
			if (!u.hasOwnProperty(r[i]))
				return false;
		}
		return true;
	}

	function subtract(l, r) {
		var u = {};
		var ret = [];
		var i;
		for (i = l.length - 1; i >= 0; i--) {
			u[l[i]] = true;
		}
		for (i = r.length - 1; i >= 0; i--) {
			if (u.hasOwnProperty(r[i]))
				delete u[r[i]];
		}
		for (var k in u) {
			if (u.hasOwnProperty(k))
				ret.push(k);
		}
		return ret;
	}

	var ret = [];
	var x, pack, name, i, temp;
	switch(expr[0]) {
		case 'LetS':
			//(LetS symb value expr)
			ret = annotateDimensions(expr[3], pass, basepack, hasChanged, packages);
			var symb = annotateDimensions(expr[1], pass, basepack, hasChanged, packages);
			var value = annotateDimensions(expr[2], pass, basepack, hasChanged, packages);
			if (symb.length > 1)
				throw new Error('Category Error ' + showS(expr[1]) + ' used as category but has dimensions ' + symb);
			ret = subtract(ret, symb);
			ret = union(ret, value);
			break;
		case 'IndexOf': // dim(IndexOf (Symb ..), value) is dim(value)
			return annotateDimensions(expr[2], pass, basepack, hasChanged, packages);
		case 'Category':
			x = annotateDimensions(expr[2], pass, basepack, hasChanged, packages);
			if (x.length > 0)
				throw new Error('Categories cannot vary over another category: ' + showS(expr));
			return expr.dimensions;
		case 'Symbol':
			if (expr.length > 2) {
				pack = expr[1];
				name = expr[2];
			} else {
				name = expr[1];
				if (packages.hasOwnProperty(name))
					pack = name; //for Data tables
				else
					pack = basepack;
			}
			//if symbol defined (then annotateDimensions of definition)
			if (packages[pack] !== undefined && packages[pack].functions[name]) {
				temp = packages[pack].functions[name];
				ret = annotateDimensions(temp, pass, temp._baseNamespace, hasChanged, packages);
			}
			//else (nothing)
			break;
		case 'Number':
			return expr.dimensions;
		case 'String':
			return expr.dimensions;
		case 'Over':
			temp = annotateDimensions(expr[1], pass, basepack, hasChanged, packages);
			var u = {};
			for(i=expr.length - 1; i > 1; i--) {
				if (expr[i] instanceof Array)
					x = annotateDimensions(expr[i],pass, basepack, hasChanged, packages);
					if (x.length > 1) {
						throw new Error('Category Error: ' + showS(expr[i]) + ' use as category but has multiple dimensions');
					}
					u[x[0]] = true;
			}
			for (i = temp.length - 1; i >= 0; i--) {
				if (!u.hasOwnProperty(temp[i]))
					ret.push(temp[i]);
			}
			break;
		case 'RemDims':
			temp = annotateDimensions(expr[1], pass, basepack, hasChanged, packages);
			var rem = annotateDimensions(expr[2], pass, basepack, hasChanged, packages);
			ret = [];
			temp.forEach(function(d) {
				if (rem.indexOf(d) === -1) ret.push(d);
			});
			break;
		case 'NoDim': //NoDim has no dimensions
			annotateDimensions(expr[1], pass, basepack, hasChanged, packages);
			ret = [];
			break;
		case 'Func':
			for(i=expr.length - 1; i > 1; i--) {
				if (expr[i] instanceof Array)
					ret = union(ret, annotateDimensions(expr[i],pass, basepack, hasChanged, packages));
			}
			break;
		default:
			for(i=expr.length - 1; i > 0; i--) {
				if (expr[i] instanceof Array)
					ret = union(ret, annotateDimensions(expr[i],pass, basepack, hasChanged, packages));
			}
	}
	if (!equal(ret,expr.dimensions)) {
		expr.dimensions = ret;
		hasChanged[0] = true;
	}
	return expr.dimensions;
}

//find all dimensions (here not in the package as it needs to go over package)
//TODO: This is really bad... it should not need keyValueDefs
//FIX: factor out the unsatisfieds dummying
function findDimensions(expr, basepack, packages, keyValueDefs) {
	function addDimension(symb) {
		var pack, name;
		if (symb.length > 2) {
			pack = symb[1];
			name = symb[2];
		} else {
			pack = basepack;
			name = symb[1];
		}
		//TODO: this next line looks like a bug...
		if (packages.hasOwnProperty(name)) pack = name; //for Data tables
		if (!packages[pack].functions.hasOwnProperty(name)) {
			var fullDim = pack + '.' + name;
			var list = ['List'];
			if (keyValueDefs[fullDim]) {
				var kvds = keyValueDefs[fullDim];
				var hash = {};
				for (var i = 0; i < kvds.length; i++) {
					for (var kvalue in kvds[i])
						hash[kvalue] = kvds[i][kvalue];
				}
				for (var kvalue in hash) list.push(hash[kvalue]);
			} else {
				packages[pack].unsatisfieds[name] = true;
				//create dummy function for unsatisfied category
			}
			packages[pack].functions[name] = ['Category', sym(pack, name), list];
			packages[pack].functions[name].dimensions = [fullDim];
		}
		packages[pack].dimensions[name] = packages[pack].functions[name];

	}
	//set dimensions on actual categories
	if (expr[0] === 'Category') {
		expr.dimensions = [expr[1][1] + '.' + expr[1][2]];
		addDimension(expr[1]);
	}

	visit(expr, function(ast, path, index) {
		var lhs;
		switch (ast[0]) {
			case 'LetS':
			case 'LetG': {
				lhs = ast[1];
				if (lhs[0] === 'Symbol')
					addDimension(lhs);
				break;
			}
			case 'Over':
			case 'Indexed': {
				//all symbols are dimensions (Over expr symb..)
				for (var i = ast.length - 1; i >= 2; i--) {
					addDimension(ast[i]);	
				}
				break;
			}
			case 'Count': //param must be a dimension
			case 'Index': //param must be a dimension
			case 'IndexOf': //lhs must be a dimension
			case 'Name': //param must be a dimension
				lhs = ast[1];
				if (lhs !== undefined && lhs[0] === 'Symbol')
					addDimension(lhs, ast);
				break;
		}
	});
}

//wrap expressions with excess dimensions in a table.
Cube.prototype.resolveExcessDimensions = function(expr, namespace) {
	var expr2;
	//TODO: this next line is hiding a bug elsewhere
	if (expr.dimensions === undefined) expr.dimensions = [];
	else if (expr.dimensions.length > 0) {
		expr2 = table(expr);
		expr2.sourceNode = expr.sourceNode;
		expr = expr2;
		annotateDimensions(expr, 0, namespace, [], this._packages); 
	}
	return expr;
};


Cube.prototype.recalculate = function() {
	console.log('Recalculating');
	var me = this;
	var name; //model name
	var model; //model instance
	var expressions; //per model
	var functions; //per model
	var rules; //per model
	var p;
	var environment = new Environment(), packages = {}, pack;

	environment._Cube = me; //allow access to the Cube for variant functions and tables
	environment._Functions = Functions;

	//Namespace is the compiled equivalent of Package
	function Namespace() {}
	Namespace.prototype = environment;

	this.names = this.names.slice(0,1); //run imports again

	var keyValueDefs = {}; //store any keys that might be defined by tables

	function _collectCell(node) { //closeure over name,model,etc //TODO: refactor
		if (node.sexpr === undefined) return; //find all cells with sexprs

		//clear error first
		node.error = undefined;

		if (node.keyValues) {
			for (var keyName in node.keyValues) {
				var keyValues = node.keyValues[keyName];
				if (keyName.indexOf('.') === -1)
					keyName = model.namespace + '.' + keyName;
				if (!keyValueDefs.hasOwnProperty(keyName)) {
					keyValueDefs[keyName] = [];
				}
				keyValueDefs[keyName].push(keyValues);
			}
		}

		//TODO: rules would need to be collected here.
		//      probably need a rule that doesn't allow
		//      rules to be created by macros
		
		//TODO: apply rules.

		var sexpr = me.preProcessSexprs(node.sexpr);
		
		sexpr.forEach(function(sexpr, index) {
			var fkey;
			//Collect packages
			visit(sexpr, function(ast, path, index) {
				switch (ast[0]) {
					case 'Symbol':
						//namespace except for function calls
						//does not support nested namespaces
						if (ast.length === 3 &&
							!(index === 1 && path[path.length-1] == 'Call') &&
							!packages.hasOwnProperty(ast[1])) {
							//add missing packages (TODO: subnamespace these)
							packages[ast[1]] = new Package(ast[1]);
						}
					break;
				}
			});
			//Collect functions and expressions
			sexpr.sourceNode = node;
   			switch(sexpr[0]) {
   				case 'Set*':
   				case 'Set':
   					if (sexpr[1] === undefined || sexpr[1][0] !== 'Symbol') {
   						node.error = 'Cannot Set '+ showS(sexpr[1]);
   					} else {
   						fkey = sexpr[1].slice(1).join('.');
   						if (!functions.hasOwnProperty(fkey)) {
   							functions[fkey] = [(sexpr[0] === 'Set*' ? 'Func*' : 'Func'), sexpr[1]];
   							functions[fkey].sourceNode = node;
   						}
   						functions[fkey].push(sexpr[2]); //just rhs
   					}
   					break;
   				case 'Category':
   					if (sexpr[1] === undefined || sexpr[1][0] !== 'Symbol') {
   						node.error = 'Cannot create Category ' + showS(sexpr[1]);
   					} else {
   						fkey = sexpr[1].slice(1).join('.');
   						if (!functions.hasOwnProperty(fkey)) functions[fkey] = sexpr;
   						else node.error = 'Cannot redefine Category ' + showS(sexpr[1]);
   					}
   					break;
   				case 'Rule':
   					node.error = 'Rules not implemented';
   					break;
   				default:
   					//expression
   					expressions[name + ':' + node.key] = sexpr;
   			}
		});
	} // end of _collectCell

	//Collect packages
	//TODO: allow subnamespaces (where they cannot have the same name as a root namespace)
	for (var ni = 0; ni <= this.names.length; ni++) { //go off the end so we can get Scratch
		name = (ni < this.names.length) ? this.names[ni] : '#Scratch';
		model = this.models[name];
		functions = {};
		expressions = {};
		model.cells.forEach(_collectCell);
		var k, func;
		//collect functions
		for (k in functions) {
			func = functions[k];
			var symb = func[1];
			p = symb[1];
			var fname = symb[2];
			pack = packages[p];
			if (pack.functions.hasOwnProperty(name)) {
				func.length = 0;
				func[0] = 'Error';
				func[1] = 'Cannot redefine ' + fname;
			} else {
				pack.functions[fname] = func;
				func._baseNamespace = model.namespace;
			}
		}

		//Note: findDimensions also makes dummy Categories for missing
		for (k in functions) {
			func = functions[k];
			clearDimensions(func); //clear dimensions to ensure recalc
			//findDimensions(func, model.namespace);
		}

		pack = packages[model.namespace];
		if (!pack) pack = packages[model.namespace] = new Package(model.namespace);
		//collect expressions (after so we can get the errors)
		for (k in expressions) {
			clearDimensions(expressions[k]); //clear dimensions to ensure recalc
			pack.expressions[k] = expressions[k];
			pack.expressions[k]._baseNamespace = model.namespace;
		}
	}

	for (p in packages) {
		if (!packages.hasOwnProperty(p)) continue;
		pack = packages[p];
		for (fname in pack.functions) {
			if (!pack.functions.hasOwnProperty(fname)) continue;
			func = pack.functions[fname];
			findDimensions(func, func._baseNamespace, packages, keyValueDefs);
		}
	}

	for (k in keyValueDefs) {
		var pack, name;
		var pn = k.split('.');
		pack = pn[0];
		name = pn[1];
		if (!packages[pack].functions.hasOwnProperty(name)) {
			var list = ['List'];
			var kvds = keyValueDefs[k];
			var hash = {};
			for (var i = 0; i < kvds.length; i++) {
				for (var kvalue in kvds[i])
						hash[kvalue] = kvds[i][kvalue];
			}
			for (var kvalue in hash) list.push(hash[kvalue]);
			packages[pack].functions[name] = ['Category', sym(pack, name), list];
			packages[pack].functions[name].dimensions = [k];
			packages[pack].dimensions[name] = packages[pack].functions[name];
		}
	}

	this._environment = environment;
	this._packages = packages;

	var hasChanged = [];
	hasChanged[0] = true;
	var pass = 0;
	var maxPasses = 10;

	while (hasChanged[0] && pass < maxPasses) {
		hasChanged[0] = false;
		for (p in packages) {
			if (!packages.hasOwnProperty(p)) continue;
			pack = packages[p];
			for (var fkey in pack.functions) {
				if (pack.functions.hasOwnProperty(fkey)) {
					try {
						annotateDimensions(pack.functions[fkey],pass, pack.functions[fkey]._baseNamespace, hasChanged, packages);
					} catch (e) {
						if (pack.functions[fkey].sourceNode)
							pack.functions[fkey].sourceNode.error = e.toString();
					}
				}
			}
					
		}
		pass = pass + 1;
	}
	if (pass === maxPasses) {
		throw new Error('Dimensions Error: Could not infer dimensions');
	}

	function objMap(obj, func, into, thisArg) {
		var ret = into || {};
		thisArg = thisArg || this;
		for (var key in obj)
			if (obj.hasOwnProperty(key)) {
				var res = func.call(thisArg, key, obj[key]);
				if (res) ret[key] = res;
			}
		return ret;
	}

	//compile functions
	objMap(packages, function(pack, packg) {
		return objMap(packg.functions, function(fname, func) {
			try {
				var comp = this.compileFunc(func, func._baseNamespace || pack);
				return comp;
			} catch(e) {
				if (func.sourceNode)
					func.sourceNode.error =  e.toString();
			}
		}, new Namespace(), this);
	}, environment, me);


	//compile expressions
	for (pack in packages) {
		if (packages.hasOwnProperty(pack)) {
			for (var fname in packages[pack].expressions) {
				if (packages[pack].expressions.hasOwnProperty(fname)) {
					var expr = packages[pack].expressions[fname]
					try {
						annotateDimensions(expr, 0, pack, [], packages);
						expr = me.resolveExcessDimensions(expr, pack);
						packages[pack].expressions[fname] = expr;
						me.compileExpression(expr, pack);
					} catch (e) {
						if (expr.sourceNode)
							expr.sourceNode.error = e.toString();
					}
					
				}
			}
		}
	}

	//remove unimported models that are not modified
	for (var n in this.models) {
		if (this.models.hasOwnProperty(n) &&
			n !== '#Scratch' &&
			!this.models[n].modified &&
			this.names.indexOf(n) === -1) {
			delete this.models[n];
		}
	}

	//TODO: add custom functions to namespace they were defined in

	if (me.onupdate) me.onupdate();
};



//Pretty printing

//TODO: this needs to take a prec so we can
// avoid too many brackets in output.
function showMr(s, skip) {
	if (s === undefined) return 'NULL';
	if (!skip && s.originalSexpr !== undefined) return showMr(s.originalSexpr);
	switch (s[0]) {
		case 'Number': return s[1].toString();
		case 'String': return s[1];
		case 'Symbol': return s.slice(1).join('.');
		case 'List':   return '{' + s.slice(1).map(showMr).join(', ') + '}';
		case 'Over':
		case 'Slice':  return showMr(s[1], true) + '[' + s.slice(2).map(showMr).join(', ') + ']';
		case 'Call':   return showMr(s[1], true) + '(' + s.slice(2).map(showMr).join(', ') + ')';
		case 'Set':
		case 'Set*':
		case 'Let': return showMr(s[1], true) +'=' + showMr(s[2]);
		case 'LetS':
			if (s[1][0] === 'Index' && s[2][0] === 'IndexOf') {
				return showMr(s[3], true) + '[' + showMr(s[1][1], true) + '=' + showMr(s[2][2], true) + ']';
			}
		case 'Neg': return '(-' + showMr(s[1]) + ')';
		case 'Plus': return '(' + s.slice(1).map(showMr).join(' + ') + ')';
		case 'Times': return '(' + s.slice(1).map(showMr).join(' * ') + ')';
		case 'Subtract': return '(' + s.slice(1).map(showMr).join(' - ') + ')';
		case 'Divide': return '(' + s.slice(1).map(showMr).join(' / ') + ')';
		case 'Power': return '(' + s.slice(1).map(showMr).join('^') + ')';
		case 'Bracket': return '(' + showMr(s[1], true) + ')';
		//TODO: make the infix check 
		default: return showS(s);
	}
}

function showM(s) {
	return ['String', showMr(s)];
}

var simple = /^\S+$/;
function showS(sexp) {
	//if (sexp instanceof Cons)
	//	return '(' + sexp.head + ' ' + sexp.tail.map(show).join(' ') + ')';
	//if (typeof(sexp) === 'number')
	//	return sexp.toString();
	//if (typeof(sexp) === 'string')
	//	return '"' + sexp + '"';
	if (sexp instanceof Array)
		return '(' + sexp.map(showS).join(' ') + ')';
	else if ((sexp instanceof String || typeof sexp === 'string'))
		return (simple.test(sexp) ? sexp : '`' + sexp + '`');
	else if (sexp === undefined)
		return 'NULL';
	return sexp.toString();
}


function _Pivot(title, page_titles, page_values, page_selected, col_headers, row_titles, row_headers, data) {
	var d = document.createElement('div');

	page_values = page_values || [];
	page_selected = page_selected || [];
	page_titles = page_titles || [];
	row_titles = row_titles || [];
	row_headers = row_headers || [];

	var nColH = col_headers[0].length - 1;
	var rows = data.length;
	var cols = data[0].length;
	var rowHs = row_titles.length;

	function page(title, values, selected) {
		return "<label for='"+ title +"'>"+title+" = </label> \
        <select name='"+title+"'>" + values.map(function(value, index) {
        	return "<option" + (selected == value ? " selected" : "") + 
        			">" + value + "</option>"
        }).join('') + "</select>";
	}

	//draw header
	var thead = '';
	for (var i = 0; i <= nColH; i++) {
		var prev = '';
		thead += '<tr>';
		for (var j = 0; j < rowHs; j++) {
			if (i === nColH) {
				thead += "<th class='highlight'>" + row_titles[j] + "</th>";
			} else {
				thead += "<th class='empty highlight'></th>";
			}
		}
		for (var j = 0; j < cols; j++) {
			var head = col_headers[j][i];
			if (head === prev) {
				thead += '<th></th>';
			} else {
				prev = head;
				thead += "<th>" + head.toString() + "</th>";
			}
		}
		thead += '</tr>';
	}

	//draw body
	var tbody = '';
	for (var i = 0; i < rows; i++) {
		tbody += '<tr>';
		for (var j = 0; j < rowHs; j++) {
			tbody += "<td class='highlight'>" + row_headers[i][j] + "</td>";
		}
		for (var j = 0; j < cols; j++) {
			tbody += "<td>" + data[i][j] + "</td>";
		}
		tbody += '</tr>';
	}

	d.innerHTML = "<div class='result'> \
<div class='pure-g'> \
<h3 class='pure-u-2-5' style='margin-top: 20px;'>" + title + "</h3> \
<form class='pure-form pure-u-3-5' style='text-align: right;'> \
    <fieldset> "+ page_titles.map(function(title, i) {
    	return page(title, page_values[i], page_selected[i])
    }).join('') +"</fieldset> \
</form> \
</div> \
<table class='pure-table pure-table-horizontal'> \
<thead>"+thead+"</thead> \
<tbody>"+tbody+"</tbody> \
</table> \
</div>";
	return d;
}

var Functions = {
	Math: Math,
	JSON: JSON,
	sin: Math.sin,
	cos: Math.cos,
	tan: Math.tan, //etc (see js/functions.js and js/functions/*)
	_tableColumn: _tableColumn, //internal - for table compile
	_Pivot: _Pivot,
};

function Environment() {}
//Environment.prototype = Functions;

function table(expr, opt_dims) {
	return expandDims(['Symbol', '_BasicTable'], expr, opt_dims)
}

function csv(expr, opt_dims) {
	return expandDims(['Symbol', '_Csv'], expr, opt_dims)
}

function workSheet(expr, p) {
	return expandDims(['Symbol', '_Sheet'], expr, undefined, p)
}

function expandDims(symb, expr, opt_dims, opt_params) {
	if (expr[0] !== 'List') {
		expr = ['List', expr];
	}
	var quoteds = expr.map(function(e, i) { return (i > 0) ? showM(e) : e; });
	var pm = ['PostMacro', ['Symbol', 'expandDims'], symb, expr, quoteds, opt_params];
	if (opt_dims !== undefined) {
		pm.push(opt_dims);
		return ['RemDims', pm, opt_dims];
	}
	return ['NoDim', pm]; 
}

function imp(path, opt_as_namespace) {
	this.import(path[1], opt_as_namespace ? opt_as_namespace[1] : undefined); //TODO: don't assume strings
	return ['Do']; //replace with call to assert namespace of is the same as....
}

Cube.Macros = {TABLE: table, IMPORT: imp, CSV: csv, SHEET: workSheet}; //see js/macros.js
Cube.PostMacros = {}; //see js/macros.js
Cube.Functions = Functions; // we add functions to this to make them available
Cube.Model = Model;
Cube.parseRaw = parseRaw;
Cube.showM = showM;
Cube.showMr = showMr;
Cube.showS = showS;
Cube._expandMacros = expandMacros;

Cube.lex = lex
Cube.parse = parse;

//Cube.Import should return a cells array
Cube.Import = function(path, cube, opt_as_namespace) { return; }; 
//should be replace by editor with a real function

base.Cube = Cube;

}(this || (typeof window !== 'undefined' ? window : global)));
