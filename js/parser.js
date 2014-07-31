/**
 * clay - computable document format.
 * Copyright (c) 2014, Benjamin Norrington (MIT Licensed)
 * 
 * Parse clay code blocks into S-Expr 
 */

;(function(clay){

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


var tokenize = function(src) {
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
					return temp;
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
					if (applyPrec > min_prec ||
					   (op.prec === min_prec && op.assoc === right)) {
						rhs = parseOperators(rhs, applyPrec);
						continue;
					}
					return rhs;
			} else {
				if (lookahead.type !== 'operator') {
					break;
				}
				if (op = infixes[token.value]) {
					if (op.prec >= min_prec ||
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


var simple = /^\S+$/;

var show = function show(sexp) {
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
}

var showp = function(prog) {
	return prog.map(show).join('\n');
}

var state = {};
// parse code and return ast
var parseCode = function(src, package) {
	try {
		state.package = package;
		var tokens = tokenize(src),
			ast = parse(tokens);
		return passOne(ast);
	} catch (e) {
		return ['Error', e];
	}
};

var expressions = function(prog) {
	return prog.filter(function(n) { return !(n.head === 'Set' || n.head === 'Rule'); });
};

//func takes non atom and path
function transform(ast, func, path) {
	if (path === undefined) path = [];
	var ret = func(ast, path);
	if (ret === undefined) ret = [];
	path.push(ast);
	for(var i=0; i<ret.length; i++) {
		var node = ret[i], node1;
		if (node instanceof Array) {
			node1 = transform(node, func, path);
			if (node !== node1) ret[i] = node1; //NOTE (in place edit)
		}
	}
	path.pop(ast);
	return ret;
}

var head = function(node) {
	if (node instanceof Array) return node[0];
};

//alternative is direct traversal
function normaliseHead(node, index, parent) {
	switch (head(node)) {
		case 'Set': {
			var lhs = node[1], expr = node[2];
			if (head(lhs)==='Slice') {
				var guards = lhs.slice(0); //shallow copy
				guards[0] = 'Guards';
				guards[1] = expr;
				if (guards.length === 2) {
					guards[2] = lhs[1]; //add self if this was an empty slice
					return normaliseHead(['Category', lhs[1], guards]);
				} else {
					return normaliseHead(['Set', lhs[1], guards]);
				}
			}
			if (head(lhs)==='Symbol' && lhs.length === 2)
				return ['Set', ['Symbol', state.package, lhs[1]], expr];
			break;
		}
		case 'Category':
			var lhs = node[1], expr = node[2];
			if (head(lhs)==='Symbol' && lhs.length === 2)
				return ['Category', ['Symbol', state.package, lhs[1]], expr];
			break;
	}
	return node;
}

function compose() {
	var functions = arguments;
	var l = functions.length;
	return function(n, index, parent) {
		for(var i=0; i<l; i++)
			n = functions[i](n, index, parent);
		return n;
	};
}

var passOne = function(ast) {
	return ast.map(compose(normaliseHead));
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


//TODO: this seems to be a more sensible structure
function Cons(head, tail) {
	this.head = head; //should be a string
	this.tail = tail; //should be an array
}


function Set() {
	for (var i = arguments.length - 1; i >= 0; i--) {
		this[arguments[i]] = true;
	};
}

Set.prototype.Clone = function() {
	var ret = new Set();
	for (k in this) {
		if (this.hasOwnProperty(k))
			ret[k] = true;
	};
};

Set.prototype.Difference = function(set) {
	var ret = this.Clone();
	if (set instanceof Set) {
		for (k in set) {
			if (set.hasOwnProperty(k))
				delete ret[k]
		}
	} else {
		for (var i = arguments.length - 1; i >= 0; i--) {
			delete ret[arguments[i]];
		}
	};
	return ret;
};

Set.prototype.Union = function(set) {
	var ret = this.Clone();
	if (set instanceof Set) {
		for (k in set) {
			if (set.hasOwnProperty(k))
				ret[k] = true
		}
	} else {
		for (var i = arguments.length - 1; i >= 0; i--) {
			ret[arguments[i]] = true;
		}
	};
	return ret;
};

Set.prototype.Intersection = function(set) {
	var ret = new Set();
	if (set instanceof Set) {
		for (k in set) {
			if (set.hasOwnProperty(k) && this.hasOwnProperty(k))
				ret[k] = true;
		}
	} else {
		for (var i = arguments.length - 1; i >= 0; i--) {
			var k = arguments[i];
			if (this.hasOwnProperty(k))
				ret[k] = true;
		}
	};
	return ret;
};

parseCode.Set = Set; //use Set to find dimensions
parseCode.state = state;
parseCode.show = show;
parseCode.showp = showp;
parseCode.parse = parse;
parseCode.lex = tokenize;
parseCode.visit = visit;
parseCode.transform = transform;

parseCode.expressions = expressions;

clay.code = parseCode;

//console.log(showp(parse(tokens,true)));

}(clay));