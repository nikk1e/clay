/**
 * cube - computable document format.
 * Copyright (c) 2014, Benjamin Norrington
 */

//requires window.Cube
;(function(base){

var Cube = base.Cube;
var showM = Cube.showM;
var showMr = Cube.showMr;

function mixin(obj, mix) {
	for (var k in mix) {
		obj[k] = mix[k];
	}
}

//Macros

var makeRecursion = function(func) {
	return function(expr) {
		var head = expr[0];
		if (head == 'Symbol') {
			return ['Let', ['Index', expr], func(expr)];
		};
		if (head == 'Subtract' || head == 'Plus') {
			var lhs = expr[1], rhs = expr[2];
			if (lhs[0] == 'Symbol' && rhs[0] == 'Number') {
				return ['Let', ['Index', lhs], [head, func(lhs), rhs]];
			}
		}
	}
}


//This should only be called at the base level
// as Flip(X, Line, {Net Income, etc})
// or X = Flip(Line, {Net Income, etc})
var flip = function(symb, catSymb, expr) {
	if (expr[0] !== 'List')
		return ['Error', 'Flip joins a list of expr', sexpr];
	var qexpr = ['List'];
	expr.slice(1).forEach(function(s) {
		qexpr.push(showM(s));
	});
	var cat = ['Category', catSymb, qexpr];
	var func = ['Set*', symb, ['Indexed*', expr, ['Index', catSymb]]]; //need Indexed* and Set* to not do memo
	return ['Do', cat, func]; //Do A B is same as A\nB
};


//Table({Table({Graph.Line(Net Income[Month])},{Assum})})
//Table({Graph.Line(Net Income[Month][Growth]*Year)})
//Table({Graph.Line(Net Income[Month][Growth])})
//Table({Graph.Line(Net Income[Month][Growth])},{Year})
//Y = Table({Graph.Line(Net Income[Month][Growth])})
var postTable = function(exprs, quoteds, dims) {
	//exprs and quoteds are both expected to be list literals

	// ***** TODO : don't bother with all this dimension stuff
	//    just call annotateDimentions on it during compile.
	if (dims === undefined) {
		dims = exprs.dimensions;
	} else {
		dims = dims.slice(1).map(function(d) { 
			return d.dimensions[0]; }
		);
	}

	var len = ['Number', dims.length];
	var heads = ['List'];
	heads.dimensions = []
	var fexpr = ['List'];
	fexpr.dimensions = dims;
	if (dims.length > 0)
		var over = ['Over', fexpr];
	else
		var over = ['List', fexpr];
	over.dimensions = [];
	dims.forEach(function(d) { 
		var s = d.split('.'); 
		s.unshift('Symbol');
		s.dimensions = [d];
		fexpr.push(s); over.push(s); heads.push(['String', s[2]]); 
	});
	exprs.slice(1).forEach(function(d) { fexpr.push(d); });
	quoteds.slice(1).forEach(function(d) { heads.push(d); });
	return ['Call', ['Symbol', 'BasicTable'], heads, over, len]; 
};

//pages should be of form {symb=value,...}
var pivot = function(expr, pages, cols, rows, descriptions) {
	return ['NoDim', ['PostMacro', ['Symbol', 'Pivot'], expr, 
		showM(expr), pages, cols, rows, descriptions]]; 
};

var postPivot = function(expr, quoted, pages, cols, rows, descriptions) {
	//TODO: .. implement this
	return ['Call', ['Symbol', '_Pivot'], showM(expr), expr]; 
};

var quoteM = function(expr) {
	return showM(expr);
};

var expand = function(expr) {
	return expandMacros(expr);
};

var quoteS = function(expr) {
	return clay.code.show(expr);
};

var nodim = function(expr) {
	return ['NoDim', expr];
};

function graphLine(expr, over, series) {
	if (series !== undefined) {
		//expr, over, series
	} else if (over !== undefined) {
		//{expr, expr2}, over
	} else {
		//expr[over][over]
		if (expr[0] == 'Slice' 
			&& expr[1][0] == 'Slice'
			&& expr[2][0] == 'Symbol' 
			&& expr[1][2][0] == 'Symbol') {
			var iexpr = expr[1][1];
			var xexpr = ['Over', expr[1][2], expr[1][2]];
			var sexpr = ['Over', expr[2], expr[2]];
			var eexpr = ['Over', ['Over', iexpr,  expr[1][2]], expr[2]]
			return ['Call', ['Symbol', 'Graph', 'LineB'], showM(iexpr), eexpr, xexpr, sexpr];
		}
	}
	return ['Call', ['Symbol', 'Graph', 'Line'], showM(expr), expr]; 
}

//most macros are applied before 
var Macros = {
	PREV: makeRecursion(function(symb) { return ['Subtract', ['Index', symb], ['Number', 1]];}),
	NEXT: makeRecursion(function(symb) { return ['Plus', ['Index', symb], ['Number', 1]];}),
	THIS: makeRecursion(function(symb) { return ['Index', symb];}),
	FIRST: makeRecursion(function(symb) { return ['Number', 0];}),
	LAST: makeRecursion(function(symb) { return ['Subtract', ['Count', symb], ['Number', 1]];}),
	PIVOT: pivot,
	QUOTE: quoteM,
	QUOTES: quoteS,
	EXPAND: expand, //usage Expand(QuoteS(...))
	NODIM: nodim,
	FLIP: flip,
	'GRAPH.LINE': graphLine,
};

//macros applied after analyse dimensions
// cannot be used in definitions as they 
// change the dimensions
var PostMacros = {
	TABLE: postTable,
	PIVOT: postPivot,
};

mixin(Cube.Macros, Macros);
mixin(Cube.PostMacros, PostMacros);



}(this || (typeof window !== 'undefined' ? window : global)));