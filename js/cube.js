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


function Model(cells, namespace, seed) {
	this.cells = cells || [];
	this.namespace = namespace || 'Main';
	this.seed = seed || 0;

	if (cells && !seed) {
		var me = this;
		this.cells.forEach(function(cell, i) {
			cell.key = me.seed++;
			cell.initialise(undefined, me);
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
}

Model.prototype.toRaw = function() {
	return this.cells.map(function(cell, i) { return cell.raw}).join('');
};

Model.prototype.clone = function() {
	return new Model(this.cells.slice(0), this.namespace, this.seed);
};

Model.prototype.insertCell = function(cell, index, mutate) {
	var me = mutate ? this : this.clone();
	cell.key = me.seed++;
	cell.initialise(undefined, me);
	me.cells.splice(index,0,cell);
	return me;
};

//update/replace
Model.prototype.updateCell = function(cell, index, mutate) {
	var me = mutate ? this : this.clone();
	cell.key = this.cells[index].key;
	cell.initialise(this.cells[index], me);
	me.cells[index] = cell;
	return me;
};

Model.prototype.removeCell = function(index, mutate) {
	var me = mutate ? this : this.clone();
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
	var raw = this.raw;
	this.lang = (/^ function +[$A-Za-z_][0-9A-Za-z_$]* *\(/.test(raw)) ? 'javascript' : 'cube';
	this.text = raw.slice(1).replace(/\n /g,'\n');

	if (this.lang === 'cube') {
		try {
			this.tokens = lex(this.text);
			this.sexpr = parse(this.tokens)
				.map(function(node) { return normaliseHeadToPackage(node, model.namespace); });
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
};


var _constructors = {
	'#': Header,
	p:   P,
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
	paras.push(new P(''));
	return paras;
}

function Cube() {
	this.models = {Scratch: new Model(parseRaw('#Scratch\nUse the scratchpad for your workings. This will not be saved!\n'))};
	this.names = [];
};

Cube.prototype.addModel = function(name, model) {
	this.names.push(name);
	this.models[name] = model;
};

Cube.prototype.mergeModel = function(name, model) {
	this.models[name] = this.models[name].merge(model);
};

Cube.Model = Model;
Cube.parseRaw = parseRaw;

base.Cube = Cube;

}(this || (typeof window !== 'undefined' ? window : global)));