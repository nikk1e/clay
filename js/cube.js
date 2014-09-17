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
		val = val.replace(/(^|[^\[])\^/g, '$1');
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
	var tokens = []
	  , cap;

	src += '\n\n'; // add a newline to src to simplify
	while (src) {
		//gobble whitespace (except newline)
		if (cap = code.whitespace.exec(src)) {
			//tokens.push("space"); //ignore space
			src = src.substring(cap[0].length);
		}

		//gobble a comment to the end of the line
		if (cap = code.comment.exec(src)) {
			src = src.substring(cap[0].length);
			continue;
		}

		//gobble a newline followed by an indent
		if (cap = code.continuation.exec(src)) {
			//tokens.push("space"); //ignore space
			src = src.substring(cap[0].length);
			continue;
		}

		if (cap = code.newline.exec(src)) {
			tokens.push({
				type: "EOL",
				value: cap[0]
			});
			src = src.substring(cap[0].length);
			continue;
		}

		if (cap = code.string.exec(src)) {
			src = src.substring(cap[0].length);
			tokens.push({
				type: "string",
				value: cap[0].slice(1, -1).replace(/""/, '"')
			})
			continue;
		}

		if (cap = code.quoted.exec(src)) {
			src = src.substring(cap[0].length);
			tokens.push({
				type: "symbol",
				value: cap[0].slice(1, -1).replace(/``/, '`')
			})
			continue;
		}

		if (cap = code.symbol.exec(src)) {
			src = src.substring(cap[0].length);
			tokens.push({
				type: "symbol",
				value: cap[0]
			});
			continue;
		}

		if (cap = code.keyword.exec(src)) {
			src = src.substring(cap[0].length);
			tokens.push({
				type: "operator", //keyword
				value: cap[0].toUpperCase()
			});
			continue;
		}

		if (cap = code.bracket.exec(src)) {
			src = src.substring(cap[0].length);
			tokens.push({type:"bracket", value:cap[0]});
			continue;
		}
		
		if (cap = code.blank.exec(src)) {
			src = src.substring(cap[0].length);
			tokens.push({type:"blank", value:cap[0]});
			continue;
		}
		
		if (cap = code.comma.exec(src)) {
			src = src.substring(cap[0].length);
			tokens.push({
				type: "comma",
				value: cap[0]
			});
			continue;
		}

		if (cap = code.operator.exec(src)) {
			src = src.substring(cap[0].length);
			tokens.push({
				type: "operator",
				value: cap[0]
			});
			continue;
		}

		if (cap = code.number.exec(src)) {
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
	};
	return ret;
}

//everything that can go in the head of a Cons
var heads = hashOf('Apply'
	, 'Set'
	, 'List'
	, 'Slice'
	, 'Optional'
	, 'Pattern'
	, 'Let'
	, 'Call' //deprecated
	);

/* M-Expr Parser */
var prefixes = {},
	postfixes = {},
	infixes = {},
	flat = 'flat',
	right = 'right',
	left = 'left';



var infix = function(pattern, name, prec, assoc) {
	if (!heads.hasOwnProperty(name)) heads[name] = name;
	infixes[pattern] = {
		'name': heads[name],
		'prec': prec,
		'assoc': assoc
	};
}
var prefix = function(pattern, name, prec) {
	if (!heads.hasOwnProperty(name)) heads[name] = name;
	prefixes[pattern] = {
		'name': heads[name],
		'prec': prec
	};
}
var postfix = function(pattern, name, prec) {
	if (!heads.hasOwnProperty(name)) heads[name] = name;
	postfixes[pattern] = {
		'name': heads[name],
		'prec': prec
	};
}

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

infix('\_', 'Subscript', 7400, right);
//\_ \% Power[Subscript]

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

prefix('#', 'Index', 7000); //index of dimension
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

infix('->', 'Rule', 1100, right);

//replaceAll

// //

infix('=', 'Set', 300, right);

// >> Put //put to filename
// >>> PutAppend

var parse = function(ts) { //,multi) {
	var tokens = ts.reverse(),
		token = tokens.pop(),
		inslice = false,
		memo,
		ast;

	function getToken() {
		return token = tokens.pop();
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
	
	function getArguments(node) {
		while (true) {
			node.push(parseOperators(parsePrimary(),0));
			if (token.type !== 'comma') {
				break;
			}
			getToken();
		};
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
					getToken();
					temp = parseOperators(parsePrimary(), 0);
					getOperator(')');
					return ['Bracket',temp]; //add bracket so we can merge the flat stuff.
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
				if (op = infixes[token.value]) {
					if (op.prec > min_prec || //This must be > and not >= for left assoc to work
					   (op.prec === min_prec && op.assoc === right)) {
						rhs = parseOperators(rhs,op.prec);
						continue;
					}
				} else if (op = postfixes[token.value]) {
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
				if (op = infixes[token.value]) {
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
				} else if (op = postfixes[token.value]) {
					if (op.prec >= min_prec) {
						getToken();
						lhs = [op.name,lhs] //{head:op.name, tail:[lhs]};
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
			if (po = prefixes[token.value]) {
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
				ast.push(['Error', 'Unexpected tokens before end of line', memo, err])
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

var head = function(node) {
	if (node instanceof Array) return node[0];
};


function normaliseHeadToPackage(node, basepackage) {
	switch (head(node)) {
		case 'Set*':
		case 'Set': {
			var s = head(node);
			var lhs = node[1], expr = node[2];
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
			var lhs = node[1], expr = node[2];
			if (head(lhs)==='Symbol' && lhs.length === 2)
				return ['Category', ['Symbol', basepackage, lhs[1]], expr];
			break;
	}
	return node;
}


function Model(cells, namespace, seed, modified, dirty) {
	this.cells = cells || [];
	this.namespace = namespace || 'Main';
	this.seed = seed || 0;
	this.modified = !!modified;
	this._dirty = !!dirty;

	if (cells && !seed) {
		var me = this;
		this.cells.forEach(function(cell, i) {
			cell.key = me.seed++;
			cell.initialise(undefined, me); //initialise will dirty *me* if needed
		});
	}
}

//Usage: Model.fromObj(JSON.parse(str));
//TODO: convert children
Model.fromObj = function(raw) {
	var obj = new Model();
	for(var i in raw)
		obj[i] = raw[i];
	return obj;
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
}

Model.prototype.toRaw = function() {
	return this.cells.map(function(cell, i) { return cell.raw}).join('');
};

Model.prototype.clone = function() {
	return new Model(this.cells.slice(0),
		this.namespace, this.seed,  this.modified, this._dirty);
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

function Cell() {};
Cell.prototype.toJSON = function() {
	var ret = {};
	for(var k in this) {
		if (k !== 'raw' && this.hasOwnProperty(k) && !(/^_/.test(k)))
			ret[k] = this[k];
	}
	ret.type = this.type;
	return ret;
}
Cell.prototype.initialise = function(old, model) {}; //override to do setup

function Header(raw) {
	this.raw = raw;
	this.level = /^#+/.exec(raw)[0].length;
	this.text = raw.slice(this.level);
}
Header.prototype = new Cell();
Header.prototype.type = 'header';

function P(raw) {
	this.raw = raw;
	this.spans = (raw.length > 0 && raw !== '\n' ? [{type: 'text', text: raw}] : []);
}
P.prototype = new Cell();
P.prototype.type = 'p';

function Figure(raw) {
	this.raw = raw;
	var sub = /^!\[([^\]]*)\]\(([^\)]*)\)(.*)/.exec(raw);
	this.alt = sub[1];
	this.src = sub[2];
	this.caption = sub[3];
}
Figure.prototype = new Cell();
Figure.prototype.type = 'figure';

function Code(raw) {
	this.raw = raw;
}
Code.prototype = new Cell();
Code.prototype.type = 'code';
Code.prototype.initialise = function(old, model) {
	model._dirty = true;
	var raw = this.raw;
	this.lang = (/^ function +[$A-Za-z_][0-9A-Za-z_$]* *\(/.test(raw)) ? 'javascript' : 'cube';
	this.text = raw.slice(1).replace(/\n /g,'\n');

	if (this.lang === 'cube') {
		try {
			this.tokens = lex(this.text);
			this.sexpr = parse(this.tokens)
				.map(function(node) { 
					return normaliseHeadToPackage(node, model.namespace); 
				});

		} catch (e) {
			return this.error = e;
		}
	}
}

function Ulli(raw) {
	this.raw = raw;
	this.spans = [{type: 'text', text: raw.slice(1)}];
}
Ulli.prototype = new Cell();
Ulli.prototype.type = 'ulli';

function Olli(raw) {
	this.raw = raw;
	this.spans = [{type: 'text', text: raw.slice(1)}];
}
Olli.prototype = new Cell();
Olli.prototype.type = 'olli';


function Quote(raw) {
	this.raw = raw;
}
Quote.prototype = new Cell();
Quote.prototype.type = 'quote';
Quote.prototype.initialise = function(old, model) {
	var r = this.raw.slice(1)
	this.spans = (r.length > 0 && r !== '\n' ? [{type: 'text', text: r}] : []);
}

function Break(raw) {
	this.raw = raw;
}
Break.prototype = new Cell();
Break.prototype.type = 'break';

function Table(raw) {
	this.raw = raw;
}
Table.prototype = new Cell();
Table.prototype.type = 'table';
Table.prototype.initialise = function(old, model) {
	model._dirty = true;
	var raw = this.raw;
	var t = raw[raw.length-1] = '\n' ? raw.slice(0,-1) : raw;

	this.rows = t.split('\n').map(function(row,i) { 
		if (row.length === 0) return {key: i, cells:[], raw: row};
		return {key: i, cells:row.slice(1).split('|'), raw: row};
	});

	this.alignments = this.rows[0].cells.map(function(c) {
	 	return /^ /.test(c) ? 
	 		{'text-align': (/ $/.test(c) ? 'center' : 'right')} : {};
	});

	this.classes = this.rows[0].cells.map(function(c) {
	 	return /= *$/.test(c) ? 'highlight' : undefined;
	});
};


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
	var textN = text;
	var paras = [];
	//       break|code                                |table                   |other
	var block = /-|(?: [^\n]*(?:\n }[^\n]*|\n  [^\n]*)*|\|(?:[^\n]|\n\||\n\n\|)*|[^\n]*)(?:\n|$)/g;

	while (block.lastIndex < text.length && (match = block.exec(textN))) {
		var l = match[0];
		var capm = /^[\#\! \*\.\>\-\|]/.exec(l);
		var cap = capm ? capm[0] : 'p';
		if (cap === '!' && !(/^!\[([^\]]*)\]\(([^\)]*)\)(.*)/.test(l))) cap = 'p';
		else if (cap === '-' && l.length > 1) cap = 'p';
		var type = _constructors[cap];
		paras.push(new type(l));
	}
	if (textN[textN.length-1] == '\n')
		paras.push(new P(''));
	return paras;
}

function Cube() {
	this.models = {'#Scratch': new Model(parseRaw('#Scratch\nUse the scratchpad for your workings. This will not be saved!\n'))};
	this.names = [];
	this._packages = {};
	this._genSyms = {};
	this._genSymCount = {};
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
	this.recalculate()
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

Cube.prototype.clean = function() {
	for (var n in this.models) {
		if (this.models.hasOwnProperty(n)) {
			this.models[n]._dirty = false;
		}
	}
};

Cube.prototype.mergeModel = function(name, model) {
	this.models[name] = this.models[name].merge(model);
	if (this.dirty()) {
		this.recalculate();
		this.clean();
	}
};

Cube.prototype.import = function(path, opt_as_namespace) {
	var model = this.models[path];
	if (!model) {
		//load model using import helper
		var cells = Cube.Import(path) || [new Header('#' + path)];
		model = new Model(cells, opt_as_namespace || path); //path fallback should be end of path
		this.models[path] = model; 
	}
	if (opt_as_namespace && model.namespace !== opt_as_namespace) {
		model.namespace = opt_as_namespace;
	}
	//if not in names then add it.
	if (this.names.indexOf(path) == -1) this.names.push(path);
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

var expandMacros = function(expr) {
	var rep;
	var sexpr;
	var symb = expr[1];

	if (expr[0] !== 'Call' || symb[0] !== 'Symbol')
		return expr;

	sexp = symb.slice(1).join('.').toUpperCase();

	if (!Cube.Macros.hasOwnProperty(sexp))
		return expr;

	rep = Cube.Macros[sexp].apply(this, expr.slice(2));

	if (rep !== undefined) {
		rep.originalSexpr = (expr.originalSexpr !== undefined) ? expr.originalSexpr : expr
		return rep;
	}

	return expr;
};

var expandPostMacros = function(expr) {
	var symb, rep;
	
	if (expr[0] !== 'PostMacro')
		throw new Exception('Cannot expand non post macro' + showS(expr));

	var symb = expr[1];
	
	if (symb[0] !== 'Symbol' || 
		symb.length !== 2 || 
		!Cube.PostMacros.hasOwnProperty(symb[1].toUpperCase()))
		return expr;

	rep = Cube.PostMacros[symb[1].toUpperCase()].apply(this, expr.slice(2));

	if (rep !== undefined) {
		rep.originalSexpr = (expr.originalSexpr !== undefined) ? expr.originalSexpr : expr
		return rep;
	}

	return expr;
};

function expandSlice(expr) {
	var ret;
	switch(expr[0]) {
		case 'Slice': {
			var ret = expr[1], overs = ['Over', 0];
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
				};
			}
			//wrap over on the outside
			if (overs.length > 2) {
				overs[1] = ret;
				ret = overs;
			}
			break;
		}
		case 'LetS': {
			//(LetS symb value expr) -> (LetS (Index symb) (IndexOf symb value) expr)
			if (expr[1][0] === 'Symbol')
			{
				var symb = expr[1], value = expr[2], exp = expr[3];
				ret = ['LetS', ['Index', symb], ['IndexOf', symb, value], exp];
			}
			break;
		}
		case 'Guards': {
			var ret = expr[1], overs = ['Indexed', 0];
			for (var i = expr.length - 1; i >= 2; i--) {
				var para = expr[i];
				if (para[0] === 'Symbol')
					overs.push(['Index', para]);
			};
			//wrap indexed on the inside
			if (overs.length > 2) {
				overs[1] = ret;
				ret = overs;
			}
			for (var i = expr.length - 1; i >= 2; i--) {
				var para = expr[i];
				switch(para[0]) {
					case 'Let':
						ret = ['LetG', para[1], para[2], ret];
						break;
					case 'Symbol':
						break;
					default:
						ret = ['Restrict', para, ret];
				};
			}
			break;
		}
	}
	if (ret !== undefined) {
		ret.originalSexpr = (expr.originalSexpr !== undefined) ? expr.originalSexpr : expr;
		return ret;
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
var memoize = function(func, hasher) {
	hasher = (hasher !== undefined) ? hasher : joinComma;
	var memo = function() {
		var cache = memo.cache, args = hasher(arguments);
		if (cache[args] === undefined)
			cache[args] = memo.func.apply(this, arguments);
		return cache[args];
	}
	memo.func = func; //so we can replace the func
	memo.clearCache = function() { memo.cache = {}; };
	memo.cache = {};
	return memo;
};

//place to store dependedOn
var unmemoize = function(func) {
	var memo = function() {
		return memo.func.apply(this, arguments);
	}
	memo.func = func; //so we can replace the func
	memo.clearCache = function() { };
	return memo;
};

var indexed = function(func, athis) {
	var memo = function(i) {
		if (memo.cache === undefined)
			memo.cache = memo.func.apply(athis);
		return memo.cache[i];
	};
	memo.func = func; //so we can replace the function
	memo.clearCache = function() { memo.cache = undefined; }
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
};


Cube.prototype.compileOver = function(expr, basepack) {
	var me = this;
	var exp = this.compileExpr(expr[1], basepack);
	var dims = expr.dimensions.map(function(d) {
		return me.Symbol(d);
	}).join(', ');
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

	var vars = '    var _k0m = 1'
	var ends = [];
	var starts = [];
	var indexes = [];
	overs.forEach(function(o, i) {
		var obj = 'env["' + o.pack + '"]["' + o.name + '"]';
		indexes.push('_k' + (i+1));
		vars = vars + ', _k' + (i+1) + ', _k' + (i+1) +
		'm = _k'+ i +'m * ' + obj +'.len()'; //.len must be defined on category
		starts.push(obj + '.forEach(function(v, ' + o.sym + ') {\n\
        _k' + (i+1) + ' = _k' + i +'m * ' + o.sym + ';');
		ends.push('})');
	});
	//var t = dims.length	> 0 ? 'this, ' : 'this'
	var ov = '(function(' + dims + ') { var _ret=[], _val;\n\
' + vars + ';\n\
    ' + starts.join('\n    ') + '\n\
        _val = '+exp+';\n\
        if (_val !== undefined) _ret['+ indexes.join(' + ') +'] = _val;\n\
    ' + ends.join('') +';\n\
    _ret.dimensions = ['+ retDims.join(', ') +'];\n\
    return _ret; \n\
}('+ dims + '))';
	return ov;
};

var quote = function quote(expr) {
	if (expr instanceof Array) {
		return '[' + expr.map(function(e) { return quote(e); }).join(', ') + ']';
	} 
	switch(typeof(expr)) {
		case 'string': return "'" + expr + "'";
		case 'number': return expr.toString();
		default: return expr.toString();
	};
}

Cube.prototype.compileExpr = function(expr, basepack) {
	var me = this;
	if (expr === undefined) return 0; //treat null as 0 (as per Spreadsheets)
	switch(expr[0]) {
		case 'PostMacro':
			return me.compileExpr(expandPostMacros(expr), basepack);
		case 'Category':
			return 'return (' + me.compileExpr(expr[2], basepack) + ');';
		case 'Func*':
		case 'Func':
			var exprs = expr.slice(2).map(function(e) {
				return '_ret = (' + me.compileExpr(e, basepack) + ');'
			});
			var ov = 'var _ret;\n\
' + exprs.join('\nif(_ret !== undefined) return _ret;\n') + '\n\
return _ret;'
			return ov;
		case 'RemDims':
		case 'NoDim':
			return me.compileExpr(expr[1], basepack);
		case 'Quote':
			return quote(expr[1]);
		case 'LetG':
			return '('+ me.compileExpr(expr[1], basepack) +' == '+ me.compileExpr(expr[2], basepack)+') ? (' + me.compileExpr(expr[3], basepack) + ') : undefined';
		case 'LetS':
			return '(function(' + me.compileExpr(expr[1], basepack) + ') { \nreturn ('+ me.compileExpr(expr[3], basepack) +'); \n}('+me.compileExpr(expr[2], basepack)+'))';
		case 'Restrict':
			return '('+ me.compileExpr(expr[1], basepack) +') ? (' + me.compileExpr(expr[2], basepack) + ') : undefined';
		case 'Call':
			return 'env.' + expr[1].slice(1).join('.') + '(' +
				expr.slice(2).map(function(e) { return me.compileExpr(e, basepack); }).join(', ') + ')';
		case 'List':
			return '[' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack); }).join(', ') + ']';
		case 'Times':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack); }).join(' * ') + ')';
		case 'Plus':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack); }).join(' + ') + ')';
		case 'Subtract':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack); }).join(' - ') + ')';
		case 'Bracket':
			return '(' + me.compileExpr(expr[1], basepack) + ')';
		case 'Divide':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack); }).join(' / ') + ')';
		case 'Equal':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack); }).join(' == ') + ')';
		case 'LessEqual':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack); }).join(' <= ') + ')';
		case 'Less':
			return '(' + expr.slice(1).map(function(e) { return me.compileExpr(e, basepack); }).join(' < ') + ')';
		case 'Indexed*':
			if (expr[1][0] !== 'List') throw new Error('Indexed* requires literal list');
			if (expr.length > 3) throw new Error('Indexed* does not yet support multiple args');
			return '(function() {\nswitch (' + me.compileExpr(expr[2], basepack) + ') {\n' +
				expr[1].slice(1).map(function(e,i) { return '  case ' + i + ': return ' + me.compileExpr(e, basepack) + ';\n'}).join('') +
				'}; })()'
		case 'Indexed': 
			if (expr.length > 3) throw new Error('Indexed does not yet support multiple args');
			var ex = me.compileExpr(expr[1], basepack);
			return '(' + ex + ')[' + me.compileExpr(expr[2], basepack) + ']';
		case 'Index':
			if (expr[1][0] !== 'Symbol') throw new Error('Invalid index parameter ' + showS(expr));
			expr = expr[1];
			var pack, name;
			if (expr.length > 2) {
				pack = expr[1];
				name = expr[2];
			} else {
				name = expr[1];
				if (me._packages.hasOwnProperty(name))
					pack = name; //for Data tables
				else
					pack = basepack;
			}
			return me.Symbol(pack + '.' + name);
		case 'IndexOf':
			if (expr[1][0] !== 'Symbol') throw new Error('Invalid indexOf parameter ' + showS(expr));
			var ex = me.compileExpr(expr[2], basepack);
			expr = expr[1];
			var pack, name;
			if (expr.length > 2) {
				pack = expr[1];
				name = expr[2];
			} else {
				name = expr[1];
				if (me._packages.hasOwnProperty(name))
					pack = name; //for Data tables
				else
					pack = basepack;
			}
			return "env['" + pack + "']['" + name +"'].indexOf(" + ex + ")";
		case 'Over':
			return me.compileOver(expr, basepack);
		case 'Symbol':
			var pack, name;
			if (expr.length > 2) {
				pack = expr[1];
				name = expr[2];
			} else {
				name = expr[1];
				if (me._packages.hasOwnProperty(name))
					pack = name; //for Data tables
				else
					pack = basepack;
			}
			//if symbol defined (then annotateDimensions of definition)
			if (me._packages[pack] !== undefined && me._packages[pack].functions[name]) {
				var dims = me._packages[pack].functions[name].dimensions.map(function(d) { return me.Symbol(d); });
				return "env['" + pack + "']['" + name +"'](" + dims.join(', ') + ")";
			} else {
				return '"' + expr.slice(1).join('.') + '"';
			}
		case 'String':
			return '"' + expr[1] + '"';
		case 'Number':
			return expr[1].toString();
		default:
			throw new Error('Compile Error: Not implemented for ' + showS(expr));
	};
};

Cube.prototype.compileFunc = function(expr, basepack) {
	var me = this;
	switch(expr[0]) {
		case 'Category':
			return indexed(new Function('var env = this;' + me.compileExpr(expr, basepack)), me._environment[basepack]);
		case 'Func*':
			var dims = expr.dimensions.map(function(d) { return me.Symbol(d); });
			return unmemoize(new Function(dims, 'var env = this;' + me.compileExpr(expr, basepack)));
		case 'Func':
			var dims = expr.dimensions.map(function(d) { return me.Symbol(d); });
			return memoize(new Function(dims, 'var env = this;' + me.compileExpr(expr, basepack)));
		default:
			var dims = expr.dimensions.map(function(d) { return me.Symbol(d); });
			var ov = 'var env = this; return (' + me.compileExpr(expr, basepack) + ');';
			//console.log(ov);
			try {
				return memoize(new Function(dims, ov));
			} catch (er) {
				console.log('Could not compile: ' + ov);
				console.log(er.message);
				return memoize(new Function('return undefined;'));
			}
			
	};
};

//Package is the ast representation of a Namespace
function Package(name) {
	this.name = name;
	this.dimensions = {};
	this.functions = {};
	this.expressions = {};
	this.unsatisfieds = {}; //dimensions that have no function
};

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


Cube.prototype.recalculate = function() {
	console.log('Recalculating');
	var me = this;
	var environment = new Environment(), packages = {}, pack;

	environment._Cube = me; //allow access to the Cube for variant functions and tables

	//Namespace is the compiled equivalent of Package
	function Namespace() {};
	Namespace.prototype = environment;

	this.names = this.names.slice(0,1); //run imports again

	//Collect packages
	//TODO: allow subnamespaces (where they cannot have the same name as a root namespace)
	for (var ni = 0; ni <= this.names.length; ni++) { //go off the end so we can get Scratch
		var name = this.names[ni] || '#Scratch';
		var model = this.models[name];
		var functions = {};
		var expressions = {};
		model.cells.forEach(function(node) {
			if (!node.sexpr) return; //find all cells with sexprs
			//expand macros
			var sexpr = []
			node.sexpr.forEach(function(expr) {
				var nodes = transform.call(me, expr, expandMacros);
				if (nodes[0] === 'Do') {
					nodes = nodes.slice(1);
					Array.prototype.push.apply(sexpr, nodes.map(function(node) {
						return normaliseHeadToPackage(node, model.namespace);
					}));
				} else {
					sexpr.push(nodes);
				}
			});

			//expand slices
			sexpr = sexpr.map(function(expr) { 
				return transform.call(me, expr, expandSlice); 
			});

			sexpr.forEach(function(sexpr, index) {
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
        					if (sexpr[1][0] !== 'Symbol') {
        					node.error = 'Cannot Set '+ showS(sexpr[1])
        				} else {
        					var fkey = sexpr[1].slice(1).join('.');
        					if (!functions.hasOwnProperty(fkey)) {
        						functions[fkey] = [(sexpr[0] === 'Set*' ? 'Func*' : 'Func'), sexpr[1]];
        						functions[fkey].sourceNode = node;
        					}
        					functions[fkey].push(sexpr[2]); //just rhs
        				}
        				break;
        			case 'Category':
        				if (sexpr[1][0] !== 'Symbol') {
        					node.error = 'Cannot create Category ' + showS(sexpr[1]);
        				} else {
        					var fkey = sexpr[1].slice(1).join('.');
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
		});

		//collect functions
		for (var k in functions) {
			var func = functions[k];
			var symb = func[1];
			var p = symb[1];
			var name = symb[2];
			pack = packages[p];
			if (pack.functions.hasOwnProperty(name)) {
				func.length = 0;
				func[0] = 'Error';
				func[1] = 'Cannot redefine ' + name;
			} else {
				pack.functions[name] = func;
				func._baseNamespace = model.namespace;
				clearDimensions(func); //clear dimensions to ensure recalc
				findDimensions(func, model.namespace);
			}
		};
		var pack = packages[model.namespace] 
		if (!pack) pack = packages[model.namespace] = new Package(model.namespace);
		//collect expressions (after so we can get the errors)
		for (var k in expressions) {
			clearDimensions(expressions[k]); //clear dimensions to ensure recalc
			pack.expressions[k] = expressions[k];
			pack.expressions[k]._baseNamespace = model.namespace;
		};
	}

	this._environment = environment;
	this._packages = packages;

	function clearDimensions(expr) {
		if (expr === undefined) return;
		delete expr.pass;
		delete expr.dimensions;
		if (expr instanceof Array) {
			for(var i=expr.length - 1; i > 0; i--) clearDimensions(expr[i]);
		}
	}

	//find all dimensions (here not in the package as it needs to go over package)
	function findDimensions(expr, basepack) {
		function addDimension(symb, parent) {
			var pack, name;
			if (symb.length > 2) {
				pack = symb[1];
				name = symb[2];
			} else {
				pack = basepack;
				name = symb[1];
			}
			if (packages.hasOwnProperty(name)) pack = name; //for Data tables
			if (!packages[pack].functions.hasOwnProperty(name)) {
				//create dummy function for unsatisfied category
				var sy = ['Symbol', pack, name];
				packages[pack].functions[name] = ['Category', sy, ['List']];
				packages[pack].functions[name].dimensions = [pack + '.' + name];
				packages[pack].unsatisfieds[name] = true;
			}
			packages[pack].dimensions[name] = packages[pack].functions[name];

		}
		//set dimensions on actual categories
		if (expr[0] === 'Category') {
			expr.dimensions = [expr[1][1] + '.' + expr[1][2]];
		}

		visit(expr, function(ast, path, index) {
			switch (ast[0]) {
				case 'LetS':
				case 'LetG': {
					var lhs = ast[1];
					if (lhs[0] === 'Symbol')
						addDimension(lhs, ast);
					break;
				}
				case 'Over':
				case 'Indexed': {
					//all symbols are dimensions (Over expr symb..)
					for (var i = ast.length - 1; i >= 2; i--) {
						addDimension(ast[i], ast);	
					}
					break;
				}
				case 'Count': //param must be a dimension
				case 'Index': //param must be a dimension
				case 'IndexOf': //lhs must be a dimension
				case 'Name': //param must be a dimension
					var lhs = ast[1];
					if (lhs !== undefined && lhs[0] === 'Symbol')
						addDimension(lhs, ast);
					break;
			};
		});
	}

	function union(l,r) {
		var u = {}, ret = [];
		for (var i = l.length - 1; i >= 0; i--) {
			u[l[i]] = true;
		};
		for (var i = r.length - 1; i >= 0; i--) {
			u[r[i]] = true;
		};
		for (var k in u) {
			if (u.hasOwnProperty(k))
				ret.push(k);
		};
		return ret;
	}

	function equal(l, r) {
		if (l.length !== r.length)
			return false;
		var u = {}, ret = [];
		for (var i = l.length - 1; i >= 0; i--) {
			u[l[i]] = true;
		};
		for (var i = r.length - 1; i >= 0; i--) {
			if (!u.hasOwnProperty(r[i]))
				return false;
		};
		return true;
	}

	function subtract(l, r) {
		var u = {}, ret = [];
		for (var i = l.length - 1; i >= 0; i--) {
			u[l[i]] = true;
		};
		for (var i = r.length - 1; i >= 0; i--) {
			if (u.hasOwnProperty(r[i]))
				delete u[r[i]];
		};
		for (var k in u) {
			if (u.hasOwnProperty(k))
				ret.push(k);
		};
		return ret;
	}

	var hasChanged = true, pass = 0, maxPasses = 10;
	//annotate dimensions of functions
	function annotateDimensions(expr, pass, basepack) {
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
		var ret = [];
		switch(expr[0]) {
			case 'LetS':
				//(LetS symb value expr)
				ret = annotateDimensions(expr[3], pass, basepack);
				var symb = annotateDimensions(expr[1], pass, basepack);
				var value = annotateDimensions(expr[2], pass, basepack);
				if (symb.length > 1)
					throw new Error('Category Error ' + showS(expr[1]) + ' used as category but has dimensions ' + symb);
				ret = subtract(ret, symb);
				ret = union(ret, value);
				break;
			case 'IndexOf': // dim(IndexOf (Symb ..), value) is dim(value)
				return annotateDimensions(expr[2], pass, basepack);
			case 'Category':
				var x = annotateDimensions(expr[2], pass, basepack);
				if (x.length > 0)
					throw new Error('Categories cannot vary over another category: ' + showS(expr));
				return expr.dimensions;
			case 'Symbol':
				var pack, name;
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
				if (packages[pack] !== undefined && packages[pack].functions[name])
					ret = annotateDimensions(packages[pack].functions[name], pass, basepack);
				//else (nothing)
				break;
			case 'Number':
				return expr.dimensions;
			case 'String':
				return expr.dimensions;
			case 'Over':
				var temp = annotateDimensions(expr[1], pass, basepack);
				var u = {}, x;
				for(var i=expr.length - 1; i > 1; i--) {
					if (expr[i] instanceof Array)
						x = annotateDimensions(expr[i],pass, basepack);
						if (x.length > 1) {
							throw new Error('Category Error: ' + showS(expr[i]) + ' use as category but has multiple dimensions');
						}
						u[x[0]] = true;
				};
				for (var i = temp.length - 1; i >= 0; i--) {
					if (!u.hasOwnProperty(temp[i]))
						ret.push(temp[i]);
				};
				break;
			case 'RemDims':
				var temp = annotateDimensions(expr[1], pass, basepack);
				var rem = annotateDimensions(expr[2], pass, basepack);
				ret = [];
				temp.forEach(function(d) {
					if (rem.indexOf(d) === -1) ret.push(d);
				});
				break;
			case 'NoDim': //NoDim has no dimensions
				annotateDimensions(expr[1], pass, basepack);
				ret = [];
				break;
			case 'Func':
				for(var i=expr.length - 1; i > 1; i--) {
					if (expr[i] instanceof Array)
						ret = union(ret, annotateDimensions(expr[i],pass, basepack));
				};
				break;
			default:
				for(var i=expr.length - 1; i > 0; i--) {
					if (expr[i] instanceof Array)
						ret = union(ret, annotateDimensions(expr[i],pass, basepack));
				};
		};
		if (!equal(ret,expr.dimensions)) {
			expr.dimensions = ret;
			hasChanged = true;
		};
		return expr.dimensions;
	}

	while (hasChanged && pass < maxPasses) {
		hasChanged = false;
		for (var p in packages) {
			if (!packages.hasOwnProperty(p)) continue;
			var pack = packages[p];
			for (var k in pack.functions) 
				if (pack.functions.hasOwnProperty(k))
					annotateDimensions(pack.functions[k],pass, pack.functions[k]._baseNamespace);
			//for (var k in pack.expressions) 
			//	if (pack.expressions.hasOwnProperty(k))
			//		annotateDimensions(pack.expressions[k],pass, pack.expressions[k]._baseNamespace);

		}
		pass = pass + 1;
	}
	if (pass === maxPasses) {
		throw new Error('Dimensions Error: Could not infer dimensions');
	}

	//compile functions
	for (pack in packages) {
		if (packages.hasOwnProperty(pack)) {
			var packg = packages[pack];
			environment[pack] = new Namespace();
			for (var name in packg.functions) {
				if (packg.functions.hasOwnProperty(name)) {
					var func = packg.functions[name];
					try {
						environment[pack][name] = this.compileFunc(func, pack)
						if (func.sourceNode)
							func.sourceNode.error = undefined;
					} catch(e) {
						if (func.sourceNode)
							func.sourceNode.error =  e.toString();
					}
					
				}
			}
		}
	}

	//compile expressions (and bind to namespace)
	for (pack in packages) {
		if (packages.hasOwnProperty(pack)) {
			var env = environment[pack];
			var packg = packages[pack];
			for (var name in packg.expressions) {
				if (packg.expressions.hasOwnProperty(name)) {
					var expr = packg.expressions[name];
					annotateDimensions(expr, 0, pack);
					if (expr.dimensions.length > 0) {
						//Wrap expressions with table
						//TODO: use original expression
						//Graph.Line(Net Income[Month])
						console.log(showS(expr) + ' has ' + expr.dimensions.join(', '));
						var expr2 = table(expr);
						expr2.sourceNode = expr.sourceNode;
						expr = expr2;
						packg.expressions[name] = expr;
						annotateDimensions(expr, 0, pack); 
						

					}
					try {
						expr.func = this.compileFunc(expr, pack);
						expr.compiled = expr.func.bind(env);
						expr.sourceNode.result = expr.compiled;
						expr.sourceNode.error = undefined;
					} catch(e) {
						console.log(e);
						expr.sourceNode.error = e.toString();
					}
					
				}
			}
		}
	}

	//remove unimported models that are not modified
	for (var n in this.models) {
		if (this.models.hasOwnProperty(n)
			&& n !== '#Scratch'
			&& !this.models[n].modified 
			&& this.names.indexOf(n) === -1) {
			delete this.models[n];
		}
	}

	//TODO: add custom functions to namespace they were defined in


};



//Pretty printing

//TODO: this needs to take a prec so we can
// avoid too many brackets in output.
function showMr(s, skip) {
	if (s === undefined) return 'NULL'
	if (!skip && s.originalSexpr !== undefined) return showMr(s.originalSexpr);
	switch (s[0]) {
		case 'Number': return s[1].toString();
		case 'String': return s[1];
		case 'Symbol': return s.slice(1).join('.');
		case 'List':   return '{' + s.slice(1).map(showMr).join(', ') + '}';
		case 'Slice':  return showMr(s[1], true) + '[' + s.slice(2).map(showMr).join(', ') + ']';
		case 'Call':   return showMr(s[1], true) + '(' + s.slice(2).map(showMr).join(', ') + ')';
		case 'Set':
		case 'Set*':
		case 'Let': return showMr(s[1], true) +'=' + showMr(s[2]);
		case 'Plus': return '(' + s.slice(1).map(showMr).join(' + ') + ')';
		case 'Times': return '(' + s.slice(1).map(showMr).join(' * ') + ')';
		case 'Subtract': return '(' + s.slice(1).map(showMr).join(' - ') + ')';
		case 'Divide': return '(' + s.slice(1).map(showMr).join(' / ') + ')';
		case 'Bracket': return '(' + showMr(s[1], true) + ')';
		//TODO: make the infix check 
		default: return showS(s);
	};
}

var showM = function(s) {
	return ['String', showMr(s)];
};


var simple = /^\S+$/;
var showS = function show(sexp) {
	//if (sexp instanceof Cons)
	//	return '(' + sexp.head + ' ' + sexp.tail.map(show).join(' ') + ')';
	//if (typeof(sexp) === 'number')
	//	return sexp.toString();
	//if (typeof(sexp) === 'string')
	//	return '"' + sexp + '"';
	if (sexp instanceof Array)
		return '(' + sexp.map(show).join(' ') + ')';
	else if ((sexp instanceof String || typeof sexp === 'string'))
		return (simple.test(sexp) ? sexp : '`' + sexp + '`');
	else if (sexp === undefined)
		return 'NULL';
	return sexp.toString();
};

var Functions = {
	Math: Math,
	sin: Math.sin,
	cos: Math.cos,
	tan: Math.tan, //etc (see js/functions.js and js/functions/*)
};

function Environment() {}
Environment.prototype = Functions;

var table = function(expr, opt_dims) {
	if (expr[0] !== 'List') {
		expr = ['List', expr];
	}
	var quoteds = expr.map(function(e, i) { return (i > 0) ? showM(e) : e });
	var pm = ['PostMacro', ['Symbol', 'Table'], expr, quoteds];
	if (opt_dims !== undefined) {
		pm.push(opt_dims);
		return ['RemDims', pm, opt_dims];
	}
	return ['NoDim', pm]; 
};

var imp = function(path, opt_as_namespace) {
	this.import(path[1], opt_as_namespace ? opt_as_namespace[1] : undefined); //TODO: don't assume strings
	return ['Do']; //replace with call to assert namespace of is the same as....
};

Cube.Macros = {TABLE: table, IMPORT: imp}; //see js/macros.js
Cube.PostMacros = {}; //see js/macros.js
Cube.Functions = Functions; // we add functions to this to make them available
Cube.Model = Model;
Cube.parseRaw = parseRaw;
Cube.showM = showM;
Cube.showMr = showMr;
Cube.showS = showS;

//Cube.Import should return a cells array
Cube.Import = function(path) { return; }; //should be replace by editor with a real function

base.Cube = Cube;

}(this || (typeof window !== 'undefined' ? window : global)));